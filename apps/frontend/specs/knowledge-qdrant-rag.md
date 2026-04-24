### 知识库检索问答（Qdrant RAG）SPEC（企业级可落地）

本 SPEC 目标：在现有知识库（`/knowledge`）基础上新增「**检索问答（Retrieval QA）**」能力：用户提问（例如“React Fiber 是什么”）时，系统自动在**全量知识库文档**中做**向量检索（Vector Search，向量搜索）**，定位相关段落，并以**RAG（Retrieval-Augmented Generation，检索增强生成）**方式生成答案。

关键约束：
- **复用 UI**：允许复用 `apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx` 的消息列表 + 输入框交互体验。
- **数据隔离**：检索问答必须与现有 `assistantStore` 的会话/历史/落库逻辑**完全隔离**，使用**独立 store**（例如 `knowledgeQaStore`），并拥有独立的后端会话/日志/权限控制。
- **入库时同步向量**：当用户保存知识库文档（新建/更新）时，必须触发「切分 → embedding → 写入 Qdrant」的异步流水线，并提供状态与重试。
- **可观测与可审计**：可追踪一次问答使用了哪些文档段落（引用/证据），并对 token/成本/延迟做指标。

---

### 1. 模块边界与目录结构（建议落地）

#### 1.1 前端

- 页面：复用 `/knowledge`（`apps/frontend/src/views/knowledge/index.tsx`）
- UI 复用策略：
  - 抽出 `KnowledgeAssistant.tsx` 的「纯渲染层」为可注入 store 的组件（建议命名 `KnowledgeAssistantView`）
  - 新增 `KnowledgeQaAssistant` 作为连接层（绑定 `knowledgeQaStore`）
- Store：
  - 新增 `apps/frontend/src/store/knowledgeQa.ts`（MobX）
- Service：
  - 新增 `apps/frontend/src/service/knowledgeQa.ts` 或扩展 `service/index.ts` 增加 QA 相关接口

#### 1.2 后端（NestJS）

新增模块（建议）：
- `knowledge-embedding`：文档切分、embedding、写 Qdrant、回填状态
- `knowledge-qa`：检索、RAG 生成、流式输出（SSE）
- `qdrant`：Qdrant client、collection 管理、健康检查

---

### 2. 核心概念与术语

- **Qdrant（Qdrant，向量数据库）**：存储向量与 payload，支持 ANN（Approximate Nearest Neighbor，近似最近邻）检索。
- **Embedding（向量表征）**：把文本片段映射到高维向量（如 768/1536/3072 维）。
- **Chunk（分块）**：将一篇文档切分为可检索的片段；每个 chunk 写入一个 point。
- **Point**：Qdrant 的向量条目（包含 `id + vector + payload`）。
- **RAG**：先检索出相关 chunks，再把 chunks 作为上下文交给模型生成回答。
- **Evidence（证据引用）**：答案引用的 chunk 列表（用于可解释与二次跳转）。

---

### 3. 数据模型与存储

#### 3.1 现有知识库实体（前提）

现有知识库接口（见 `apps/frontend/src/service/index.ts`）：
- `POST /knowledge/save`：新建
- `PUT /knowledge/update/:id`：更新
- `GET /knowledge/detail/:id`：详情含正文
- `GET /knowledge/list`：分页列表

本文新增的数据结构必须与 `KnowledgeRecord`（`id/title/content/author/authorId/...`）兼容。

#### 3.2 新增：Embedding 索引状态表（后端 DB）

新增表（示意）`knowledge_embedding_job`（或并入 knowledge 表字段，推荐独立表便于审计）：

- `jobId`（uuid）
- `knowledgeId`（string，知识库 id）
- `tenantId`（若有多租户；没有则可为 null）
- `authorId`（number）
- `contentHash`（string）：对 `title + content` 计算稳定 hash（用于幂等、避免重复 embedding）
- `status`：`queued | processing | succeeded | failed`
- `errorMessage`（nullable）
- `chunkCount`（int）
- `qdrantCollection`（string）
- `createdAt/updatedAt`

幂等键：`(knowledgeId, contentHash)`。

#### 3.3 Qdrant collection 设计

推荐 collection：`knowledge_chunks_v1`

- **向量维度**：与 embedding 模型一致（例如 1536）
- **distance**：`Cosine`
- **payload schema（最小字段）**：
  - `knowledgeId: string`
  - `authorId: number`
  - `title: string`
  - `chunkIndex: number`
  - `text: string`（chunk 文本）
  - `contentHash: string`
  - `createdAt: string`
  - `updatedAt: string`
  - `tags?: string[]`（可选：由规则抽取）

Point id 建议：
- `uuid`（简单）或 `knowledgeId__hash__chunkIndex`（可覆盖写）

过滤策略：
- 默认按 `authorId` 过滤（用户仅检索自己的知识库），或按产品要求扩展到团队共享（需 RBAC）。

---

### 4. 文档入库（保存时写向量）

#### 4.1 触发时机

当发生以下事件时触发 embedding 更新：
- `POST /knowledge/save` 成功（新建）
- `PUT /knowledge/update/:id` 成功（更新）
- （可选）从回收站恢复/批量导入

#### 4.2 处理流程（异步流水线）

1) 计算 `contentHash = hash(title + \"\\n\\n\" + content)`  
2) 若 `(knowledgeId, contentHash)` 已 `succeeded`，跳过（幂等）  
3) 文本切分（chunking）  
4) 对每个 chunk 生成 embedding（批处理）  
5) 写入 Qdrant：
   - 同一个 `knowledgeId` 的旧 `contentHash` points 需要删除或标记过期
   - 推荐：按 `knowledgeId` filter delete，再 upsert 新 points（数量可控时简单可靠）
6) 回填 `knowledge_embedding_job.status=succeeded`，写入 `chunkCount`

失败：
- `failed` + `errorMessage`（截断）
- 支持重试（指数退避 + 最大次数）

#### 4.3 Chunking 规则（可落地默认）

默认策略（可配置）：
- 以 Markdown 结构优先切分：标题（`#`/`##`）为段落边界
- 目标 chunk 字符数：800–1200（或 token 数 300–500）
- 重叠（overlap）：100–200 字符（避免跨段丢信息）
- 代码块（```）作为整体尽量不拆（若过长则按行切）

每个 chunk 存储：
- `text`：纯文本（可保留代码块）
- `chunkIndex`：稳定递增

---

### 5. 检索问答（Retrieval QA）

#### 5.1 用户动作

用户在知识库页面发起提问：
- 输入：“React Fiber 是什么？”
- 期望：系统返回回答，并附带“引用的文档片段/来源”。

#### 5.2 检索策略

输入：`question`、`authorId`（或 tenant/scope）、可选 `topK`

流程：
1) `questionEmbedding = embed(question)`
2) Qdrant 搜索：
   - filter：`authorId == currentUserId`（默认）
   - topK：默认 6（可调 3–12）
   - 返回：`score + payload(text,title,knowledgeId,chunkIndex)`
3) 去重与重排：
   - 同一 `knowledgeId` 过多命中时限制最多 N 条（例如 3）
   - 可选：相邻 chunk 合并（chunkIndex ±1）形成更完整上下文
4) 构建 RAG 上下文：
   - 以引用块形式拼接：`[title#chunkIndex] text`
5) 调用 LLM 生成回答：
   - 系统提示要求：只基于提供上下文回答；若不足则明确“未找到”
6) 输出：
   - `answerText`
   - `evidences[]`（引用列表）

#### 5.3 SSE 流式协议（建议）

前端期望复用 `KnowledgeAssistant` 的流式渲染体验，因此后端建议输出 SSE：
- `event: qa.start`：runId、检索参数
- `event: qa.retrieval`：返回命中文档摘要（可用于 UI 展示“正在检索到 …”）
- `event: qa.delta`：回答增量 token
- `event: qa.done`：完成 + evidences
- `event: qa.error`：错误

---

### 6. 前端 UI 复用与 store 隔离设计

#### 6.1 现状约束（为什么要改造）

`KnowledgeAssistant.tsx` 当前直接引用 `assistantStore`（`assistantStore.messages/sendMessage/stopGenerating/...`），因此若要“复用 UI 但隔离数据”，必须把 UI 与 store 解耦。

#### 6.2 建议：抽象出 Store 接口 + 纯渲染层

定义最小接口（示意）：

- `messages: Message[]`
- `isHistoryLoading/isSending/isStreaming: boolean`
- `sendMessage(text, options?)`
- `stopGenerating()`
- `activateForDocument(documentKey)`（对 QA 可简化为 `activateForScope(scopeKey)`）

落地方式：
- 将 `KnowledgeAssistant.tsx` 拆成：
  - `KnowledgeAssistantView.tsx`：只吃 `props.store` + `props.documentKey` + `props.editorHasBody`
  - `KnowledgeAssistant.tsx`：现有连接层继续绑定 `assistantStore`
  - 新增 `KnowledgeQaAssistant.tsx`：绑定 `knowledgeQaStore`

#### 6.3 新增 `knowledgeQaStore`（独立数据域）

职责：
- 管理 QA 会话的 messages（不与 assistant 会话共用）
- 调用 `GET/POST /knowledge/qa/ask` SSE 接口并流式更新
- 记录 evidences，用于“点击跳转到知识文档并高亮 chunk”（二期）

持久化策略：
- 默认不落库（ephemeral），可选“保存本次问答到知识库”（二期）

---

### 7. 权限、隔离与安全

- **默认隔离**：用户仅检索 `authorId == currentUserId` 的知识库。
- **共享知识库（可选）**：扩展 filter 为 `teamId` + RBAC；必须在 payload 存储 `visibility`。
- **注入防护**：RAG 提示词必须要求忽略上下文中的“提示注入”；代码块不执行。
- **数据脱敏**：日志与审计不得写入原文全文，只记录 knowledgeId + chunkIndex + hash。

---

### 8. 可观测性与运维

#### 8.1 指标（Metrics）

- `embedding_job_latency_p95`
- `embedding_job_failed_rate`
- `qa_latency_p95`
- `qdrant_search_latency_p95`
- `tokens_per_qa`、`cost_per_qa`

#### 8.2 日志（Logs）

每次 QA 记录：
- runId、authorId、topK、命中文档数、模型名、耗时、错误码

每次 embedding 记录：
- jobId、knowledgeId、chunkCount、耗时、失败原因

---

### 9. 失败处理与回滚

- Qdrant 不可用：
  - QA：返回“检索服务不可用，请稍后重试”
  - 入库：job 标记 failed，可重试
- Embedding 模型超时：
  - job 失败并记录错误；不影响知识库保存主流程（保存成功但检索不可用）
- 回滚策略：
  - 若 embedding 写入新 points 后失败：可通过 `contentHash` 标记最新；或先写临时，再切换 alias（二期优化）

---

### 10. 验收清单（可直接测试）

#### 10.1 入库

- [ ] 新建知识文档后，embedding job 进入 queued，并最终 succeeded（chunkCount>0）
- [ ] 更新同一文档内容后，旧 points 被替换（相同 knowledgeId 下 contentHash 更新）
- [ ] 重复保存相同内容不重复入库（幂等生效）

#### 10.2 检索问答

- [ ] 在已有“React 面试”相关文档的前提下提问“React Fiber 是什么”，能命中相关 chunks 并给出回答
- [ ] 回答包含 evidences（至少 1 条），可展示来源标题
- [ ] 上下文不足时明确提示“未找到相关内容”，不胡编

#### 10.3 数据隔离

- [ ] QA 的消息列表不与 assistant 会话串联（刷新/切文档时不污染）
- [ ] `knowledgeQaStore` 不会调用 `assistantStore` 的任何持久化/迁移逻辑

