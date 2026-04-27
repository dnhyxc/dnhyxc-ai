### 深度调研报告生成 Agent（Deep Research Report Agent）后端实现 SPEC（NestJS + DeepAgents）

> 面向场景：用户输入一个问题（例如“评估某技术选型/竞品分析/法规解读/架构调研”），系统自动拆解任务，启动多个子 Agent 并行执行（检索、阅读、归纳、对比、引用校验），最终生成一份结构化“企业级调研报告”，并支持工具调用（tools）、技能（skills）、记忆（memory）与 sandbox（沙箱）等企业级能力。

---

### 1. 目标与范围

- **目标**
  - 提供一个“深度调研报告生成”能力：输入问题 → 并行子 Agent 执行 → 汇总成报告（Markdown/JSON）→ 可持续追踪任务状态与可回放（replay）。
  - 支持企业级 Agent 能力：
    - **并行（parallelism）**：多个子 Agent 并行运行、可限流、可取消。
    - **工具调用（tool calling，工具调用）**：可调用自定义 tools（例如：内部知识库、数据库查询、HTTP 抓取、GitHub、文件读取等）。
    - **技能（skills，技能包）**：可复用预置技能（如“写作模板”“对比分析”“风险评估”）。
    - **记忆（memory，记忆系统）**：短期会话记忆 + 长期组织记忆（向量检索/结构化存储）。
    - **Sandbox（沙箱）**：每个子 Agent 在受限权限环境运行（网络/文件/CPU/时长），可审计。
    - **可观测性（observability，可观测性）**：事件流、日志、token/cost、工具调用追踪、traceId。
  - 与现有后端鉴权（JWT）与统一响应拦截器保持一致。

- **范围**
  - 后端新增一个业务域：`/research`（或挂在 `/agent`）的 REST API +（可选）SSE 流式状态推送。
  - 新增 DeepAgents 运行时与插件系统（tools/skills/memory/sandbox）的后端适配层。
  - 新增持久化：任务、运行记录、产出报告、引用来源、工具调用审计。

- **非目标**
  - 不在本 Spec 内强制绑定某一特定大模型厂商；模型能力通过可配置 Provider 抽象。
  - 不要求前端必须流式展示（但后端需提供流式/轮询两套模式之一或两者）。

---

### 2. 现状基线与集成点（基于仓库现有代码）

- **鉴权**：现有 `AuthModule` + JWT（`JwtStrategy`/`JwtGuard`）可复用保护研究任务接口。
- **缓存**：现有 `@nestjs/cache-manager`（Redis）已用于流式取消/状态协调（见 `AssistantService` 的 epoch/busy key 思路），可复用到 Agent 任务取消与并行协调。
- **数据库**：TypeORM + `synchronize` 可配（开发可自动建表，生产建议迁移），适合落地任务与审计表。
- **既有 AI 服务**：已有 `AssistantService`（GLM 流式等）可作为“LLM Provider/流式输出/预算控制”的实现参考，但本 Spec 不与其强耦合。

---

### 3. 核心概念与术语

- **DeepAgents（深度代理框架）**：负责 Agent/子 Agent 的生命周期、规划、并行执行、工具调用与记忆接入的运行时框架。
- **Orchestrator（编排器）**：顶层 Agent（主 Agent），负责任务拆解、调度子 Agent、合并结果与生成最终报告。
- **Sub-Agent（子代理）**：被编排器启动的并行执行单元（例如：检索、阅读、对比、风险、结论等）。
- **Tool（工具）**：可被 Agent 调用的函数能力（带 schema、权限、审计）。
- **Skill（技能）**：可复用的 prompt/流程模板或策略（可参数化、可版本化）。
- **Memory（记忆）**
  - **Short-term memory（短期记忆）**：本次任务上下文（计划、子结果、引用）。
  - **Long-term memory（长期记忆）**：组织知识/用户偏好/历史报告（向量或结构化存储）。
- **Sandbox（沙箱）**：对工具与执行环境做权限隔离（网络域名白名单、文件系统作用域、CPU/时长限制等）。
- **Filesystem（文件系统）**：Agent 可访问的文件与目录抽象层（workspace、本地缓存、对象存储、只读资料库），带权限、审计与配额。
- **Runner（执行器）**：用于运行外部代码/命令的受控执行环境；本 Spec 推荐以 Daytona Sandbox 作为 Runner 的隔离边界。
- **Citation（引用）**：报告中的每条关键结论需可追溯到来源（URL/文档片段/内部知识条目）。
- **Human-in-the-loop（人类在环）**：在关键节点引入人工审核/反馈，使任务可“暂停等待人工决策 → 恢复执行”，用于提升正确性、可控性与合规性。

---

### 4. 用户可见功能点（按用户动作拆分）

#### 4.1 创建调研任务：`POST /research/tasks`

- **触发入口**
  - 用户在 Web/Tauri 输入问题并提交“生成调研报告”。

- **前置条件/互斥条件**
  - 需要登录（JWT）。
  - 同一用户的并发任务数有上限（例如 1～3 个），超限返回 429/400（按项目规范）。

- **状态变化**
  - 创建 `ResearchTask` 记录（status=queued）。
  - 写入初始配置快照（模型、预算、sandbox、tools、skills）。

- **网络/执行**
  - 进入队列（BullMQ）或后台执行器（worker）启动 Orchestrator。

- **响应**
  - 返回 `taskId` 与初始状态。

#### 4.2 订阅任务进度（任选其一或两者）

- **SSE**：`GET /research/tasks/:id/events`
  - 推送：plan、subAgentStarted、toolCall、citationFound、partialReport、completed、failed 等事件。
- **轮询**：`GET /research/tasks/:id`
  - 返回当前状态、百分比（可选）、最近事件摘要、token/cost、已生成的章节。

#### 4.3 取消任务：`POST /research/tasks/:id/cancel`

- **前置条件**
  - 只有任务 owner 或管理员可取消。
- **机制**
  - 使用 Redis epoch/busy 机制或 cancellation token，让所有子 Agent 尽快停止（工具调用需可中断）。

#### 4.4 获取最终报告：`GET /research/tasks/:id/report`

- **返回**
  - Markdown（默认）或 JSON（结构化章节、引用、附录）。

#### 4.5 Human-in-the-loop：人工审阅与介入（暂停/恢复/批注/审批）

> 目标：让用户/审核人可以在关键节点介入（改计划、删来源、要求补证据、调整结论风格），并能把决定“写回任务”，从而驱动后续子 Agent 的执行方向。

- **触发入口（常见介入点）**
  - 计划（outline）生成后：用户确认/修改大纲与调研范围
  - 来源（sources）收集后：用户筛选可信来源/添加内部资料/屏蔽域名
  - 关键结论（key findings）形成后：用户要求“必须给引用/补充对照实验/增加风险段落”
  - 最终报告输出前：用户审批“是否发布/是否写入长期记忆/是否落盘到指定目录”

- **状态变化**
  - 任务进入 `waiting_human`（可作为 `research_task.status` 扩展值，或用 `research_task.status=running + humanBlock=true` 表达；二选一并保持一致）
  - 记录 `human_action`（谁、何时、做了什么、影响范围）

- **权限**
  - 任务 owner：可提交反馈与批准/拒绝
  - 组织审核人（可选）：可执行最终审批（尤其当写入长期记忆/写入特定目录/出网等需要更高权限时）

---

### 5. 状态模型与数据结构（TypeORM 建议）

#### 5.1 核心实体

- **`research_task`**
  - `id`（uuid）
  - `userId`（number）
  - `question`（text）
  - `status`：`queued | running | waiting_human | completed | failed | cancelled`
  - `clientType`：`web | desktop`（可选）
  - `createdAt/updatedAt`
  - `startedAt/completedAt`
  - `errorCode/errorMessage`（失败时）
  - `configSnapshot`（json）：模型、预算、tools、skills、sandbox、memory 策略的快照（便于回放）

- **`research_run_event`（事件溯源，建议）**
  - `id`（uuid）
  - `taskId`
  - `ts`
  - `type`（string enum）
  - `payload`（json）
  - 用途：SSE/回放/审计/调试

- **`research_artifact`（产物）**
  - `id`
  - `taskId`
  - `type`：`outline | section | final_markdown | final_json | raw_notes`
  - `content`（text/json）
  - `version`（number）

- **`research_citation`（引用）**
  - `id`
  - `taskId`
  - `sourceType`：`web | internal_knowledge | file | db`
  - `sourceRef`（例如 URL/知识条目 id/文件路径）
  - `snippet`（text）
  - `hash`（用于去重）
  - `usedInSections`（json array）

- **`research_tool_audit`（工具调用审计）**
  - `id`
  - `taskId`
  - `subAgentId`
  - `toolName`
  - `input`（json，脱敏后）
  - `outputMeta`（json，脱敏后）
  - `durationMs`
  - `status`：`ok | error | cancelled`

- **`research_human_action`（人类在环动作，建议）**
  - `id`（uuid）
  - `taskId`
  - `userId`（执行动作的人）
  - `role`：`owner | reviewer | admin`（可选）
  - `type`：
    - `approve_plan | request_plan_change`
    - `approve_sources | block_source | add_source`
    - `approve_findings | request_more_citations`
    - `approve_final | reject_final`
    - `pause | resume | cancel`
  - `payload`（json）：例如修改后的大纲、被屏蔽的 URL 列表、补充资料路径、意见文本
  - `createdAt`

#### 5.2 并发与幂等

- `POST /research/tasks` 支持 `idempotencyKey`（幂等键）：同一用户同一 key 重复提交返回同一 taskId（避免双击）。

---

### 6. Agent 架构与并行编排（DeepAgents 运行时）

#### 6.1 Orchestrator（主 Agent）职责

- 解析用户问题 → 生成调研计划（outline + 子任务列表）
- 根据计划启动子 Agent，并行执行（并发上限可配置）
- 汇总子结果，做一致性检查（冲突观点、证据不足）
- 生成最终报告（结构化 Markdown + 引用列表）
- 在预设的人工闸点（human gates）暂停并等待人工决策，然后基于决策继续执行或调整计划

#### 6.2 子 Agent 角色划分（建议默认 5～8 个）

- **Planner Agent**：生成大纲、关键问题、信息缺口
- **Search Agent**：检索候选来源（web/internal memory）
- **Reader Agent(s)**：阅读与摘要（每个来源一个或分批）
- **Comparator Agent**：对比方案/竞品/利弊矩阵
- **Risk/Compliance Agent**：风险、合规、边界条件
- **Writer Agent**：生成报告正文（按模板）
- **Verifier Agent**：引用校验、事实一致性检查（尽量避免“无引用结论”）

> 这些角色不是硬编码：应通过 skills 配置化，可按问题类型启用/禁用。

#### 6.3 并行执行策略

- **并发上限**：按 `RESEARCH_MAX_PARALLEL_SUBAGENTS`（例如 4～8）
- **阶段栅栏（barrier）**
  - 阶段 1：plan
  - 阶段 2：search 并行
  - 阶段 3：read/summarize 并行
  - 阶段 4：compare/risk/verifier 并行
  - 阶段 5：write → finalize
- **人工闸点（human gates）**
  - `gate.plan`：plan 完成后可进入 `waiting_human`
  - `gate.sources`：sources 聚合后可进入 `waiting_human`
  - `gate.findings`：关键结论输出后可进入 `waiting_human`
  - `gate.final`：最终报告落盘/写入长期记忆前可进入 `waiting_human`
  - 闸点是否启用由 `skills` 或 `sandboxPolicy/hitlPolicy` 控制（默认建议：`plan + final`）
- **取消传播**
  - 任务 cancel 后：主 Agent 设置 cancellation token；子 Agent 与工具层必须周期性检查并尽快退出

---

### 6.4 Human-in-the-loop（人类在环）执行模型（必须）

#### 6.4.1 HITL 策略配置（建议）

- `hitlPolicy`（可在 `POST /research/tasks` 传入，或由后端按用户/组织策略注入）
  - `enabled: boolean`（默认 true）
  - `gates: Array<'plan' | 'sources' | 'findings' | 'final'>`
  - `timeoutMs?: number`（可选：超时自动继续/自动取消/自动降级生成）
  - `reviewerRoleRequired?: boolean`（可选：是否需要 reviewer 才能批准 final）
  - `actions`：允许的动作集合（例如是否允许 block_source、是否允许修改大纲）

#### 6.4.2 暂停/恢复语义

- **暂停（pause）**
  - Orchestrator 在闸点写入 `research_run_event: human_gate_requested`
  - 设置 `research_task.status=waiting_human`
  - 后续子 Agent 不再启动；已在跑的子 Agent 允许自然结束或尽快收敛（按成本策略）
- **恢复（resume）**
  - 写入 `research_human_action` + `research_run_event: human_gate_resolved`
  - `status` 回到 `running`
  - Orchestrator 读取 `payload`（例如新大纲/屏蔽来源），并据此调整后续执行

#### 6.4.3 可审计性

- 任何人工动作必须：
  - 落 `research_human_action`
  - 同步写 `research_run_event`（便于 SSE 推送与回放）

---

### 7. Tools（自定义工具）体系

#### 7.1 Tool 规范（企业级）

- **Schema**：每个 tool 必须提供输入/输出 JSON schema（用于校验与前端展示）
- **权限（permission）**：声明所需权限（例如：`network:domainAllowlist`、`db:read`、`fs:workspaceReadonly`）
- **审计（audit）**：每次调用必须写 `research_tool_audit`
- **超时/重试**：tool 必须定义 `timeoutMs`，必要时允许有限重试
- **脱敏（redaction）**：对输入/输出做敏感字段脱敏（token、cookie、密钥、个人信息）

#### 7.2 内置 tools（建议最小集合）

- `web_search`：联网检索（受域名/配额限制）
- `web_fetch`：抓取网页正文（受 allowlist/robots 策略约束）
- `knowledge_search`：内部知识库检索（如 Qdrant/数据库）
- `file_read`：读取工作区可访问文件（只读、路径白名单）
- `file_write`：写入工作区指定路径文件（受写入白名单/冲突策略/审计约束）
- `summarize_text`：对长文本做分段摘要（可由 LLM 代替，但保留为工具便于统一审计）

> 你也可以把已有的“知识问答/embedding”能力包成 tools，统一接入 Agent。

#### 7.3 文件读取/写入工具（必须补齐的企业级细则）

> 目标：让 Agent 能“读项目文件、生成报告文件、产出中间产物”，同时确保不会误读敏感文件、不会任意覆盖用户代码，并且所有读写可审计、可回放。

##### 7.3.1 `file_read`（读取文件）

- **用途**
  - 读取 workspace 中用户允许的文件：例如用户上传的资料、历史报告、项目 README、设计文档、配置示例等。

- **输入（Input schema，示意）**
  - `path: string`（相对 workspace 的路径，禁止绝对路径）
  - `offset?: number`（可选，从第几行/第几个字节开始；按实现选择）
  - `limit?: number`（可选，最大读取长度；避免一次性读超大文件）
  - `encoding?: 'utf8'`（默认 utf8）

- **输出（Output schema，示意）**
  - `content: string`
  - `truncated: boolean`
  - `mimeType?: string`
  - `sha256?: string`（可选，用于缓存/去重）

- **权限与 sandbox**
  - 只允许读取 `sandboxPolicy.fs.readAllowlist` 中的路径前缀
  - 强制拒绝读取：
    - `.env`、`**/*.pem`、`**/*id_rsa*`、`**/credentials*`、`**/secret*` 等敏感文件
    - `node_modules/`、`dist/`、`build/` 等大目录（避免无意义读取与成本爆炸）
  - 单次最大读取量：例如 256KB（可配置）

##### 7.3.2 `file_write`（写入文件）

- **用途**
  - 让 Agent 生成并落盘：
    - 最终调研报告（如 `apps/backend/reports/*.md` 或 `apps/backend/specs/generated/*.md`）
    - 中间产物（outline、notes、citations JSON）

- **输入（Input schema，示意）**
  - `path: string`（相对 workspace 的路径，禁止绝对路径）
  - `content: string`
  - `mode?: 'create' | 'overwrite' | 'append'`（默认 `create`）
  - `ifMatchSha256?: string`（可选：并发/冲突控制；仅当现有文件 hash 匹配才写入）
  - `mkdirp?: boolean`（默认 true：自动创建父目录）
  - `contentType?: 'text/markdown' | 'application/json' | 'text/plain'`

- **输出（Output schema，示意）**
  - `written: boolean`
  - `path: string`
  - `bytes: number`
  - `sha256: string`
  - `created: boolean`
  - `overwritten: boolean`

- **权限与 sandbox（强制）**
  - 只允许写入 `sandboxPolicy.fs.writeAllowlist` 中的路径前缀（例如 `apps/backend/specs/generated/`、`apps/backend/reports/`）
  - 强制拒绝写入：
    - `apps/backend/src/**`（避免 Agent 直接改代码，除非显式授予更高权限）
    - 任意隐藏文件（`**/.*`）
    - `.env*`、密钥文件、证书文件等敏感路径
  - 写入模式默认 **只创建不覆盖**：`mode=create`
  - 覆盖写入必须满足：
    - 调用方显式 `mode=overwrite`
    - 且 `ifMatchSha256` 校验通过（避免覆盖用户手工编辑）

- **审计（research_tool_audit）**
  - `input` 必须记录：`path`、`mode`、`contentType`、`bytes`（不要存全文 content，避免敏感泄露与审计表膨胀）
  - `outputMeta` 必须记录：`sha256`、`created/overwritten`、`bytes`

- **与产物系统的关系**
  - 写文件成功后，应同步写一份 `research_artifact`：
    - `type=final_markdown` 或 `final_json`
    - `content` 可存全文（数据库存储策略由你决定；也可仅存引用与路径）
    - `payload` 里记录 `filePath` 与 `sha256`

---

### 7.4 Filesystem（文件系统）能力（超越单个 tool 的系统层能力）

> 目标：支持“多个文件源 + 统一权限 + 可审计 + 可配额 + 可桥接到 Daytona Sandbox Runner”，让 Agent 在生成报告、整理资料、执行外部代码时，有一致的文件系统语义。

#### 7.4.1 Filesystem 适配层（接口建议）

- **接口（示意）**
  - `stat(path)`：获取元信息（大小、hash、mtime、mimeType）
  - `readFile(path, { offset, limit })`
  - `writeFile(path, content, { mode, ifMatchSha256 })`
  - `listDir(path, { recursive, limit })`
  - `mkdirp(path)`
  - `delete(path)`（默认禁用，需显式授权）

- **实现（建议至少两种）**
  - **WorkspaceFS（工作区文件系统）**
    - 面向：读取项目内文档、写入报告产物
  - **ArtifactFS（产物文件系统）**
    - 面向：把最终报告/中间产物统一落到固定目录（例如 `apps/backend/reports/`），便于归档与下载
  - （可选）**ObjectStorageFS（对象存储）**
    - 面向：大文件、用户上传附件、跨机器 worker 共享（S3/OSS/MinIO）

#### 7.4.2 权限模型（Filesystem 级）

- **读权限**
  - `readAllowlistPrefixes: string[]`
  - `denyGlobs: string[]`（强制）
- **写权限**
  - `writeAllowlistPrefixes: string[]`
  - `defaultWriteMode: 'create' | 'append' | 'overwrite'`（默认 `create`）
  - `overwriteRequiresIfMatch: boolean`（默认 true）
- **配额**
  - `maxReadBytesPerTask`
  - `maxWriteBytesPerTask`
  - `maxFileCountPerTask`

#### 7.4.3 与 Tools 的关系

- `file_read/file_write` 只是暴露给 Agent 的“入口 tool”
- tool 内部必须调用 Filesystem 适配层，从而确保：
  - 权限校验与 denyGlobs 一致
  - hash/审计口径一致
  - 可选地把文件能力桥接到 Daytona Sandbox Runner（见 10.4）

---

### 8. Skills（技能）体系

- **技能结构**
  - `skillId`、`version`、`description`
  - `promptTemplate`（可参数化）
  - `applicability`（适用问题类型：tech/legal/product/market）
  - `requiredTools`（运行此 skill 需要哪些 tools）
  - `outputContract`（产出结构：outline/sections/json）

- **技能加载策略**
  - 任务创建时：根据问题分类（classifier）选择技能组合
  - 允许用户显式指定：`skillsOverride`（可选，管理员或高级用户）

---

### 9. Memory（记忆系统）体系

#### 9.1 短期记忆（任务内）

- 存储位置：数据库（`research_artifact`）+ Redis（热状态）
- 内容：计划、子结果、候选来源列表、引用片段、写作草稿

#### 9.2 长期记忆（跨任务）

- 存储位置：向量库（例如 Qdrant）+ 结构化索引表
- 写入策略：
  - 仅将“最终报告摘要 + 高价值引用 + 结论”写入长期记忆（避免噪声）
  - 对敏感内容做访问控制（按用户/组织隔离）

---

### 10. Sandbox（沙箱）与权限模型

#### 10.1 Sandbox 目标

- 防止 Agent 随意访问网络/文件/数据库导致安全事故
- 将工具能力最小化授权、可审计、可回滚

#### 10.2 权限维度（建议）

- **网络**：domain allowlist + 速率限制 + 总请求数上限
- **文件系统**：
  - `readAllowlist`：可读路径前缀白名单
  - `writeAllowlist`：可写路径前缀白名单
  - `denyGlobs`：拒绝读取/写入的 glob（如 `.env*`、`**/*.pem`）
- **数据库**：只读/指定 schema；禁止写操作（除审计表）
- **执行预算**：
  - `maxRunMs`
  - `maxToolCalls`
  - `maxInputTokens/maxOutputTokens`

#### 10.3 Sandbox 落地方式（两种可选）

- **方式 A：进程内 sandbox（更快）**
  - 通过 tool 层做严格权限校验 + 超时控制
  - 优点：实现简单、资源开销小
  - 风险：隔离不如进程级强，需要更严谨的审计与防护

- **方式 B：进程/容器级 sandbox（更强）**
  - 每个任务或子 Agent 在独立 worker 进程/容器运行
  - 优点：隔离强
  - 成本：实现与部署复杂度更高

---

### 10.4 接入 Daytona Sandbox（第三方 SandSandbox）执行沙箱（用于“外部代码执行 + 批量文件操作”）

> 需求：当 Agent 需要执行外部代码/命令或进行批量文件操作时，不允许直接在宿主机执行；统一在 Daytona 提供的 Sandbox 中执行，并复用 Daytona 的进程执行（process）、文件系统（fs）、网络策略与资源配置能力。
>
> Daytona 参考文档：
> - [Sandboxes](https://www.daytona.io/docs/en/sandboxes)
> - [Process code execution](https://www.daytona.io/docs/en/process-code-execution.md)
> - [FileSystem（TypeScript SDK）](https://www.daytona.io/docs/en/typescript-sdk/file-system/)
> - [API Authentication](https://mintlify.com/daytonaio/daytona/api/authentication)

#### 10.4.1 触发条件与使用边界

- **必须走 Daytona Sandbox 的场景**
  - `code_execute` / `shell_execute` 类型工具（运行命令、执行脚本）
  - 大规模文件遍历/处理（解压、格式转换、数据清洗、生成图表等）
  - 需要安装依赖（pip/npm/cargo/go mod 等）但不希望污染宿主机
- **不需要 Daytona Sandbox 的场景**
  - 仅 `file_read/file_write` 小文件读写（仍受 Filesystem 权限约束）
  - 纯 LLM 写作/总结（无外部代码）

#### 10.4.2 Daytona 适配层（后端内部 Runner API 建议）

> 把 Daytona SDK/API 封装在后端 `DaytonaRunner` 中，屏蔽第三方差异，避免业务代码散落调用。

- `createSandbox({ taskId, subAgentId, preset, resources, networkPolicy, env }) -> { sandboxId }`
- `exec({ sandboxId, cmd, cwd, env, timeoutMs }) -> { exitCode, stdout, stderr, durationMs }`
- `upload({ sandboxId, localPath, sandboxPath })` / `download({ sandboxId, sandboxPath, localPath })`
- `destroySandbox({ sandboxId })`

> 对 Agent 暴露为 tool 时，可包装成 `code_execute` / `shell_execute`，并强制走 `DaytonaRunner.exec()`。

#### 10.4.3 鉴权与租户隔离（关键）

- **鉴权**
  - 使用 Daytona API Key（Bearer）进行服务端调用（见 [API Authentication](https://mintlify.com/daytonaio/daytona/api/authentication)）
  - API Key 只存后端配置中心/环境变量，严禁下发到前端
- **组织/租户隔离**
  - `sandbox` 必须携带 `labels`（或等价元信息）：
    - `app=dnhyxc-ai`
    - `taskId=<...>`、`userId=<...>`、`env=<prod|staging|dev>`
  - 任何查询/销毁 sandbox 的操作必须基于 `taskId` 反查并校验 owner（防止越权操作他人 sandbox）

#### 10.4.4 多语言运行环境（主流语言运行时要求）

> Daytona Sandbox 的“运行时能力”通过 **preset/target/镜像**（以 Daytona 能力为准）提供。这里用“能力清单”定义验收目标，而不在本仓库构建 Dockerfile。

- **必须满足的运行环境（建议最小集合）**
  - Python（脚本、数据处理）
  - Node.js（脚本、工具链）
  - Go（编译/运行小工具）
  - Java（可选）
  - Rust（可选）
  - 常用工具链：`git`、`curl`、`wget`、`unzip`、`tar`、`jq`
- **选择策略**
  - `sandboxPolicy.runnerPreset` 指定预设（例如 `standard` / `full`）
  - 不同 preset 对应不同资源（CPU/内存/磁盘）与工具链覆盖率

#### 10.4.5 文件与 Filesystem 的桥接（关键）

- **目录约定**
  - sandbox 内工作目录：`/workspace`
  - 输出目录：`/workspace/out`
- **桥接原则**
  - Agent 的 `Filesystem` 是“控制面”，Daytona `fs` 是“数据面”
  - 任何从 sandbox 产出的文件，必须：
    - 先下载到后端受控临时目录
    - 再由 Filesystem 层按 `writeAllowlist/denyGlobs/配额` 校验后写入 workspace（或 ObjectStorageFS）
- **上传策略**
  - 若需要让 sandbox 处理输入文件：
    - 从 Filesystem 读取后上传到 sandbox `/workspace/in/...`
    - 严禁把宿主机路径直接挂载给第三方 sandbox

#### 10.4.6 网络策略（默认最小化）

- 默认：**阻断全部网络**（Daytona 支持 `network_block_all` / `network_allow_list` 等策略能力时应启用，具体以 Daytona 能力字段为准，见 [Sandboxes](https://www.daytona.io/docs/en/sandboxes)）
- 若任务明确需要下载依赖/抓取数据：
  - 优先方式：sandbox 仍禁网，由后端 `web_fetch/web_download` 代理下载并上传到 sandbox（易审计）
  - 次选方式：为 sandbox 设置 allowlist 域名（严格白名单 + 审计）

#### 10.4.7 资源限制与预算

- 资源（以 Daytona sandbox 资源配置能力为准）：
  - CPU / memory / disk /（可选 GPU）
- 预算：
  - 每次 `exec` 强制 `timeoutMs`
  - 任务级 `maxRunMs` 与 `maxToolCalls`
- 自动治理（建议）
  - 设置 auto-stop / auto-delete（以 Daytona 支持字段为准），避免资源泄漏

#### 10.4.8 审计

- 每次 `exec` / `upload` / `download` 都必须写入 `research_tool_audit`：
  - `toolName`：`code_execute` / `shell_execute` / `sandbox_upload` / `sandbox_download`
  - `input`：`sandboxId`、`cmd/cwd/timeoutMs`（脱敏 env）、文件路径（仅记录 sandbox 内路径与逻辑文件名）
  - `outputMeta`：`exitCode/durationMs/stdoutBytes/stderrBytes/outFiles`、文件 hash/bytes

#### 10.4.9 Daytona Dashboard 字段映射与示例（来自当前项目截图）

> 用途：把 Daytona 上的可视化配置项与本 Spec 的 `sandboxPolicy`/`DaytonaRunner.createSandbox` 入参一一对应，便于运维与联调对齐。

- **示例 Sandbox（截图信息）**
  - `name`: `dnhyxc-ai`
  - `uuid`（sandboxId）: `ea2dbcf8-a15b-4f66-9af3-e462c514dd4b`
  - `state`: `Started`
  - `region`: `eu`
  - `snapshot`: `daytonaio/sandbox...`（截图截断；以 Daytona 实际 snapshot id 为准）
  - `createdAt`: `2026/4/27 16:26:54`
  - `autoStop`: `15m`
  - `autoArchive`: `7d`
  - `autoDelete`: `Disabled`
  - `resources`:
    - `cpu`: `1 vCPU`
    - `memory`: `1 GiB`
    - `disk`: `3 GiB`
  - `labels`:
    - `code-toolbox-language`: `python`

- **字段映射（建议）**
  - `name` → `DaytonaRunner.createSandbox({ name })`
  - `uuid` → `sandboxId`（写入 `research_tool_audit.outputMeta.sandboxId`，并落 `research_task.configSnapshot.daytona.sandboxId` 便于追踪）
  - `region` → `sandboxPolicy.daytona.region`（或 runner preset 的默认 region）
  - `snapshot` → `sandboxPolicy.daytona.snapshot`（用于选择运行环境）
  - `autoStop/autoArchive/autoDelete` → `sandboxPolicy.daytona.lifecycle`
    - `autoStopInterval`: `15m`
    - `autoArchiveInterval`: `7d`
    - `autoDeleteInterval`: `disabled`
  - `resources(cpu/memory/disk)` → `sandboxPolicy.daytona.resources`
  - `labels` → `sandboxPolicy.daytona.labels`
    - 必须包含：`app/taskId/userId/env`
    - 可选包含：`code-toolbox-language=python`（用于约束语言工具链或选择 preset）

- **推荐把 `sandboxPolicy` 扩展为 Daytona 专用结构**
  - `sandboxPolicy.daytona`（示意）
    - `region?: string`
    - `snapshot?: string`
    - `resources?: { cpu?: number; memoryGiB?: number; diskGiB?: number }`
    - `lifecycle?: { autoStop?: string; autoArchive?: string; autoDelete?: string }`
    - `network?: { blockAll?: boolean; allowList?: string[] }`
    - `labels?: Record<string, string>`

---

### 11. 接口契约（REST + SSE）

#### 11.1 创建任务：`POST /research/tasks`

- **Request**
  - `question: string`
  - `clientType?: 'web' | 'desktop'`
  - `mode?: 'fast' | 'deep'`（深度影响并行度/检索数/预算）
  - `idempotencyKey?: string`
  - `toolsOverride?: string[]`（可选，受权限控制）
  - `skillsOverride?: string[]`（可选，受权限控制）
  - `memoryPolicy?: { enableLongTerm: boolean }`（可选）
  - `sandboxPolicy?: { networkAllowlist?: string[]; maxRunMs?: number; maxToolCalls?: number }`
  - `hitlPolicy?: { enabled?: boolean; gates?: Array<'plan'|'sources'|'findings'|'final'>; timeoutMs?: number }`

- **Response**
  - `taskId: string`
  - `status: 'queued' | 'running'`

#### 11.2 查询任务：`GET /research/tasks/:id`

- **Response**
  - `taskId`
  - `status`
  - `progress`（0-1，可选）
  - `latestEvent`（可选）
  - `usage`：`{ inputTokens, outputTokens, toolCalls, cost? }`（可选）

#### 11.3 订阅事件：`GET /research/tasks/:id/events`（SSE）

- **事件类型（建议）**
  - `plan_created`
  - `subagent_started`
  - `subagent_completed`
  - `tool_call_started`
  - `tool_call_completed`
  - `citation_found`
  - `section_draft`
  - `final_report`
  - `human_gate_requested`
  - `human_gate_resolved`
  - `human_comment`
  - `error`

#### 11.4 取消任务：`POST /research/tasks/:id/cancel`

- **Response**：`{ success: true }`

#### 11.6 Human-in-the-loop 接口（建议最小集合）

- `POST /research/tasks/:id/comments`
  - 用途：用户/审核人对当前阶段提交反馈（不一定改变状态）
  - Request：`{ message: string; attachments?: Array<{ type:'file'; path:string }> }`
  - Response：`{ success: true }`

- `POST /research/tasks/:id/actions`
  - 用途：对某个闸点做“批准/拒绝/修改/继续”等决策
  - Request（示意）：
    - `type: 'approve_plan' | 'request_plan_change' | 'approve_sources' | 'block_source' | 'add_source' | 'approve_findings' | 'request_more_citations' | 'approve_final' | 'reject_final' | 'resume' | 'pause'`
    - `payload?: any`（例如新大纲、屏蔽 URL 列表、补充资料路径、发布选项）
  - Response：
    - `success: true`
    - `status: 'waiting_human' | 'running' | 'cancelled'`（动作后任务状态）

#### 11.5 获取报告：`GET /research/tasks/:id/report?format=md|json`

- **Response**
  - `md`：返回 Markdown 文本
  - `json`：返回结构化章节 + 引用列表

---

### 12. 可观测性与审计

- **traceId**：每个任务生成 `traceId`，贯穿日志、事件、工具调用审计
- **指标（metrics）**
  - 任务耗时、失败率、取消率
  - 平均并行子 agent 数、工具调用次数
  - token/成本分布
- **审计**
  - `research_tool_audit` 必须覆盖所有 tool 调用
  - 对敏感数据做脱敏存储

---

### 13. 失败策略与重试

- **可重试错误**
  - 网络超时、上游 5xx、部分来源抓取失败
- **不可重试错误**
  - 权限不足、sandbox 拒绝、参数非法
- **部分失败降级**
  - 若部分来源失败，仍可生成报告，但需在“局限性/证据不足”章节显式披露

---

### 14. 验收清单（可直接用于测试）

- **并行**
  - 同一任务启动多个子 Agent 并行执行，且不会超过并发上限
- **可取消**
  - 任务运行中取消，子 Agent 与工具调用在可接受时间内停止
- **human-in-the-loop**
  - 开启 `hitlPolicy` 后，在 `plan/final` 闸点任务会进入 `waiting_human` 并停止继续推进
  - 提交 `approve_plan` 后任务恢复 `running` 并按批准的大纲继续执行
  - 提交 `block_source` 后后续 search/read 不再使用被屏蔽来源（且有审计记录）
  - `approve_final` 前不会写入长期记忆、不会落盘到 writeAllowlist（除非策略允许）
- **工具调用与审计**
  - 每次 tool 调用都有审计记录（toolName、耗时、状态、脱敏输入输出）
- **sandbox**
  - 不在 allowlist 的域名抓取被拒绝，并返回可定位错误
  - 读取敏感文件（如 `.env`）被拒绝
- **filesystem**
  - 允许读取/写入白名单目录，拒绝 denyGlobs（`.env*`、证书、密钥等）
  - overwrite 需要 `ifMatchSha256`，否则拒绝覆盖
- **daytona sandbox runner**
  - 外部代码执行不会在宿主机运行（审计可证明：sandboxId、preset/资源配置、网络策略）
  - 默认禁网；需要下载依赖时走代理下载或受控 allowlist 出网
  - sandbox 只能写 `/workspace/out/`，越权写入被拒绝
- **记忆**
  - 任务内可引用先前子 Agent 结果
  - 开启长期记忆时，任务结束写入摘要，并可被后续任务检索到（权限隔离正确）
- **报告质量**
  - 关键结论都有引用（Citation）支撑
  - 存在“局限性/不确定性”披露

---

### 15. 实施步骤（最小可落地）

- **第 1 步：新增 Research 模块**
  - `ResearchModule` + `ResearchController` + `ResearchService`
  - 接入 JWT 守卫与统一响应格式

- **第 2 步：落库**
  - 建 `research_task/research_run_event/research_artifact/research_citation/research_tool_audit`

- **第 3 步：接入 DeepAgents 运行时（Orchestrator + Sub-Agent）**
  - 定义角色与并行策略
  - 定义事件协议并落 `research_run_event`

- **第 4 步：tools/skills/memory/sandbox 的最小闭环**
  - 至少实现：`web_search/web_fetch/knowledge_search`
  - skills：实现默认“企业调研报告模板” skill
  - memory：实现任务内短期记忆（artifact），长期记忆可后置
  - sandbox：实现 domain allowlist + maxRunMs + maxToolCalls

- **第 5 步：SSE/轮询**
  - 实现 SSE 事件推送（或先轮询，后补 SSE）

- **第 6 步：验收与压测**
  - 按验收清单逐条验证，并压测并发任务与工具调用上限

