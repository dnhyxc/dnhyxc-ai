### 知识库 + 向量检索问答（Qdrant + DashScope Embedding + GLM）后端 SPEC（实现反推）

> 说明：本文档从当前仓库实现反推，覆盖 `apps/backend/src/services/knowledge`、`knowledge-embedding`、`knowledge-qa`、`qdrant` 四个模块的**现状行为**与**可验收条款**。

---

### 1. 目标与范围

- **目标**
  - 提供“知识库（Knowledge）”的 CRUD 与回收站能力（MySQL/TypeORM 持久化）。
  - 在保存/更新知识库内容后，异步执行“切分 → 向量化 → 写入 Qdrant”，用于后续检索。
  - 提供“知识库检索问答（Knowledge QA）”接口：问题向量化 → Qdrant 检索 → 拼接证据上下文 → 调用 GLM（智谱）流式生成答案（SSE）。
- **范围**
  - 知识库接口：`/api/knowledge/*`
  - 检索问答接口：`/api/knowledge/qa/ask`（SSE）
  - 向量入库：由 `KnowledgeService` 触发，异步执行（不阻塞主流程）
  - 向量库：Qdrant（REST，6333）
  - Embedding（向量模型）：DashScope（百炼）多模态向量原生接口（文本模式）
  - LLM（大模型）：GLM（智谱）`/chat/completions` 流式 SSE
- **非目标**
  - 不包含“入库任务队列化（BullMQ）”的实现（仅在注释中提及）。
  - 不包含 embedding/检索结果的缓存、版本迁移、向量压缩等高级特性。
  - 不包含 Rerank（重排）/Hybrid Search（混合检索）等策略。

---

### 2. 目录结构与关键入口

- **模块目录**
  - `apps/backend/src/services/knowledge/`
  - `apps/backend/src/services/knowledge-embedding/`
  - `apps/backend/src/services/knowledge-qa/`
  - `apps/backend/src/services/qdrant/`
- **入口文件**
  - 知识库 HTTP 入口：`apps/backend/src/services/knowledge/knowledge.controller.ts`
  - 知识库业务：`apps/backend/src/services/knowledge/knowledge.service.ts`
  - 向量入库：`apps/backend/src/services/knowledge-embedding/knowledge-embedding.service.ts`
  - QA HTTP 入口：`apps/backend/src/services/knowledge-qa/knowledge-qa.controller.ts`
  - QA 业务：`apps/backend/src/services/knowledge-qa/knowledge-qa.service.ts`
  - Qdrant SDK 注入：`apps/backend/src/services/qdrant/qdrant.module.ts`
  - Qdrant 访问封装：`apps/backend/src/services/qdrant/qdrant.service.ts`
- **关键依赖**
  - **鉴权**：`JwtGuard`（`@UseGuards(JwtGuard)`）
  - **统一响应包装**：`ResponseInterceptor`（仅知识库 CRUD controller 使用）
  - **ORM**：TypeORM repositories（`Knowledge`、`KnowledgeTrash`）
  - **向量库 SDK**：`@qdrant/js-client-rest`
  - **网络**：Node `fetch`（DashScope/GLM/Qdrant SDK 内部均使用 fetch/undici）

---

### 3. 核心概念与术语

- **Knowledge（知识库）**
  - MySQL 中的知识条目，包含 `title/content/author/authorId/...`。
- **KnowledgeTrash（回收站）**
  - 删除时保存快照到回收站表；主表物理删除。
- **Chunk（分片）**
  - `KnowledgeEmbeddingService.chunkMarkdown()` 输出的片段（标题优先、长度兜底、带 overlap）。
- **Embedding（向量）**
  - 由 DashScope embedding 接口将文本映射为 `number[]`。
- **Collection（集合）**
  - Qdrant 存储向量点的集合。默认名：`knowledge_chunks_v1`。
- **Point（点）**
  - Qdrant 中的一条记录：`{ id, vector, payload }`。
- **payload（载荷）**
  - 随点存储的业务字段（`knowledgeId/title/text/...`），用于过滤与证据展示。
- **SSE（Server-Sent Events，服务端事件推送）**
  - `data: <json>\n\n` 行流协议；客户端逐行解析。

---

### 4. 用户可见功能点（按用户动作拆分）

#### 4.1 新建知识库条目（保存 Markdown）

- **触发入口**
  - HTTP：`POST /api/knowledge/save`
- **前置条件/互斥条件**
  - 需要通过 `JwtGuard`（未登录返回 401）。
- **状态变化（数据库）**
  - 在 `Knowledge` 表插入一行。
- **网络调用（向量入库）**
  - 在保存成功后，异步触发 `embeddingService.safeIndexKnowledge(...)`：
    - 不阻塞 `POST /save` 的响应返回。
- **UI 表现**
  - 由前端处理；后端返回 `{ id }`（在 `ResponseInterceptor` 包装下为统一响应格式）。
- **错误处理与回滚**
  - 保存失败：直接抛错（由全局异常/拦截器处理）。
  - 向量入库失败：不会影响保存接口成功返回；失败会记录日志并返回 `null`（内部吞掉异常）。
- **边界条件**
  - `title` 为空：保存为 `null`（并在入库时兜底为“未命名”）。
  - `content` 为空：仍会保存；入库时 chunk 为空会触发删除旧点并返回 `chunkCount=0`。

#### 4.2 更新知识库条目（更新标题/正文/作者信息）

- **触发入口**
  - HTTP：`PUT /api/knowledge/update/:id`
- **前置条件/互斥条件**
  - 需要通过 `JwtGuard`。
  - DTO 中若未提供任何可更新字段：抛 `BadRequestException('请至少提供一项要更新的字段')`。
- **状态变化（数据库）**
  - 更新 `Knowledge` 表对应行，并返回更新后的实体。
- **网络调用（向量入库）**
  - 更新成功后异步触发 `safeIndexKnowledge(...)`，将最新内容覆盖写入向量库。
- **错误处理与回滚**
  - 同 4.1：入库失败不影响更新成功返回。
- **边界条件**
  - 更新后 chunk 数量变化属于正常情况；入库采取“覆盖式重建”（见 6.3）。

#### 4.3 删除知识库条目（进入回收站 + 清理助手会话）

- **触发入口**
  - HTTP：`DELETE /api/knowledge/delete/:id`
- **前置条件/互斥条件**
  - 需要通过 `JwtGuard`。
- **状态变化（数据库）**
  - 在事务中：
    - 将 `Knowledge` 行快照写入 `KnowledgeTrash`
    - 删除 `AssistantSession`（按 `knowledgeArticleId=row.id`）
    - 物理删除 `Knowledge` 行
- **向量库处理**
  - 当前实现：删除知识库时**未显式删除 Qdrant points**。
  - 影响：若不额外清理，Qdrant 可能残留该 `knowledgeId` 的 points（检索侧仍可能命中）。
- **错误处理与回滚**
  - 事务失败：回滚，不产生部分删除。

#### 4.4 知识库列表/详情

- **触发入口**
  - 列表：`GET /api/knowledge/list`
  - 详情：`GET /api/knowledge/detail/:id`
- **行为**
  - 列表返回不含大字段 `content` 的列表项（减少体积）。
  - 详情返回含 `content` 的完整记录。

#### 4.5 回收站列表/详情/删除（含批量删除）

- **触发入口**
  - 列表：`GET /api/knowledge/trash/list`
  - 详情：`GET /api/knowledge/trash/detail/:id`
  - 删除：`DELETE /api/knowledge/trash/delete/:id`
  - 批量删除：`POST /api/knowledge/trash/delete-batch`
- **行为**
  - 批量删除会对每个 trash id 先清理对应的 `AssistantSession`（通过 `knowledgeArticleId` 前缀映射）。

#### 4.6 知识库检索问答（SSE 流式）

- **触发入口**
  - `POST /api/knowledge/qa/ask` + `@Sse()`（SSE 返回）
- **前置条件/互斥条件**
  - 需要通过 `JwtGuard`。
- **状态变化（流式事件）**
  - 事件序列（后端 `QaEvent`）：
    - `qa.start`：包含 `runId`
    - `qa.retrieval`（可选）：检索证据数组
    - 多次 `qa.delta`：模型输出增量文本
    - `qa.done`：结束并携带证据数组
    - `qa.sse.done`：controller 额外追加的 SSE 结束标记
    - `qa.error`：错误事件（controller 层 catchError 也可能产出）
- **网络调用**
  - Embedding：`KnowledgeEmbeddingService.embedQuery(question)`
  - 检索：`QdrantService.searchKnowledgeChunks({ vector, topK, authorId })`
  - 推理：GLM（智谱）`POST {baseURL}/chat/completions`，`stream: true`
- **UI 表现**
  - 客户端按 `data:` 行解析 JSON，逐步拼接 `qa.delta` 到 UI。
- **错误处理与回滚**
  - 任一步异常：服务端推送 `qa.error` 并 complete；controller 会将异常转为 SSE `{data:{type:'qa.error',...}}`。
- **边界条件**
  - 检索结果为空：服务端会输出一段固定提示文案并 `qa.done` 结束。

---

### 5. 状态模型与数据结构

#### 5.1 Qdrant payload：`QdrantKnowledgePayload`

- 字段
  - `knowledgeId: string`
  - `authorId: number | null`
  - `title: string`
  - `chunkIndex: number`
  - `text: string`
  - `contentHash: string`
  - `createdAt: string`（ISO）
  - `updatedAt: string`（ISO）

#### 5.2 QA 事件：`QaEvent`（服务端内部）

- `qa.start { runId }`
- `qa.retrieval { evidences }`
- `qa.delta { content }`
- `qa.done { evidences }`
- `qa.error { message }`
- 以及 controller 追加：`qa.sse.done`

---

### 6. 协议与接口契约

#### 6.1 知识库 HTTP API（带全局前缀 `/api`）

- `POST /api/knowledge/save`
- `GET /api/knowledge/list`
- `GET /api/knowledge/detail/:id`
- `PUT /api/knowledge/update/:id`
- `DELETE /api/knowledge/delete/:id`
- `GET /api/knowledge/trash/list`
- `GET /api/knowledge/trash/detail/:id`
- `DELETE /api/knowledge/trash/delete/:id`
- `POST /api/knowledge/trash/delete-batch`

> 说明：KnowledgeController 使用 `ResponseInterceptor` 包装返回体为 `{data, code, message, success}` 风格。

#### 6.2 QA SSE 协议

- Endpoint：`POST /api/knowledge/qa/ask`（SSE）
- SSE 行格式：
  - `data: <json>\n\n`
- JSON 结构：
  - controller 将 service 的 `QaEvent` 包装为 `{ data: QaEvent }` 作为 SSE 输出。

#### 6.3 向量入库协议（DashScope 原生 embedding）

- Endpoint（拼接）：
  - `${origin}/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding`
  - `origin` 从 `QWEN_BASE_URL` 推导（若包含 `/compatible-mode/v1`，取其 origin）。
- Headers：
  - `Authorization: Bearer <apiKey>`
  - `Content-Type: application/json`
- Body：
  - `model: <KNOWLEDGE_EMBEDDING_MODEL | 'qwen3-vl-embedding'>`
  - `input.contents: Array<{ text: string }>`
- 返回解析：
  - 优先读取 `output.embeddings`，兼容 `output.data/data/embeddings` 变体；
  - 每个元素内取 `embedding`（或兼容 `vector/output.embedding/...`）。
- 限制策略：
  - 分批：`batchSize=10`（避免服务端 batch 限制）
  - 重试：`maxAttempts=3`（对网络层失败线性退避）
  - 超时：60s

#### 6.4 向量库协议（Qdrant）

- Collection
  - 默认：`knowledge_chunks_v1`
  - 创建：`vectors.size = vectorSize`，`distance='Cosine'`
- 写入策略
  - `ensureKnowledgeCollection(vectorSize)`
  - `delete` 过滤：payload `knowledgeId == <id>`
  - `upsert`：写入 points（每个 chunk 一个 point）
- 检索策略
  - `search(limit=topK, with_payload=true)`
  - 可选 filter：`authorId` 精确匹配

---

### 7. 互斥与状态机（关键规则）

- **入库与主流程互斥**
  - `saveMarkdown/update` 不等待入库完成（异步触发）。
  - 入库失败不会影响 CRUD 返回。
- **SSE 生命周期**
  - 客户端断开/取消订阅：
    - service 层 `unsubscribe` 会 `abortController.abort()`，中止 GLM 请求。

---

### 8. 性能与工程约束

- **分批向量化**
  - 采用 `batchSize=10` 分批，减少单次请求体积与失败概率。
- **超时与重试**
  - embedding 调用 60s 超时，网络层失败最多 3 次重试。
- **避免响应体过大**
  - knowledge list 不返回 `content` 字段。

---

### 9. 错误提示与日志规范

- **入库失败日志**
  - `[KnowledgeEmbeddingService] indexKnowledge failed: knowledgeId=... err=... cause=... stack=...`
- **QA 失败**
  - 通过 SSE 输出 `qa.error`，并结束流。

---

### 10. 验收清单（可直接用于测试）

- **知识库 CRUD**
  - 能保存/更新/删除知识条目；列表分页与筛选正常。
  - 删除会写入回收站快照；回收站可分页/详情/删除/批量删除。
- **向量入库**
  - 保存/更新后不阻塞接口返回（前端立刻拿到 id/更新结果）。
  - 入库成功后 Qdrant dashboard 能看到 `knowledge_chunks_v1` collection。
  - 更新同一篇文档后，检索命中内容应反映最新正文（旧内容不应残留）。
- **检索问答（SSE）**
  - 触发后能收到 `qa.start`。
  - `includeEvidences=true` 时能收到 `qa.retrieval`（含 title/chunkIndex/score/text）。
  - 能持续收到 `qa.delta`，最终 `qa.done`，最后 `qa.sse.done`。
  - 检索为空时输出固定提示文案并结束。
  - 中途断开连接后端能停止下游 GLM 请求（不继续产生输出）。

