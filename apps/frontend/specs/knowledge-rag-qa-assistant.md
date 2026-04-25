## 知识库页面新增 RAG 问答助手（前端）SPEC

> 目标：在不影响知识库现有功能（编辑、保存、列表、回收站、现有 AI 助手等任何逻辑）的前提下，于 `@apps/frontend/src/views/knowledge` 增加一个**知识库 RAG 问答助手**入口，并且实现与现有 `assistant` 类似的流式体验与“跨路由/跨面板切换不中断流”的持久化体验。

---

## 1. 背景与约束

- **现状**：
  - 知识库编辑页右侧已有 `KnowledgeAssistant`（基于 `assistantStore`）提供通用 AI 助手能力。
  - `KnowledgeAssistant` 使用 `assistantStore` 的“按 documentKey 维度多态缓存 + SSE 流式增量 + 视图切换不打断”的架构。
  - `KnowledgeAssistant` 的输入区使用 `ChatEntry`，并在 `entryChildren={<div></div>}` 预留扩展位。

- **强约束（必须满足）**：
  - **不能影响一丁点现有功能逻辑**：默认行为必须与现在完全一致；新增功能只能是“可选启用”的附加层。
  - 在 `entryChildren` 中新增“选择 AI 助手 / RAG 助手”的 UI。
  - **默认选择 AI 助手**（即默认仍然走现有 `assistantStore` 逻辑）。
  - **RAG 助手前端数据必须与 assistant 区分**：单独 store、单独消息列表、单独流状态、单独 abort/stop。
  - **实现逻辑要与 assistant 类似**（仅限“流式体验与并发模型”层面）：
    - 支持流式（打字机）增量更新。
    - UI/路由切换不应中断正在输出的流。
  - **RAG 助手与当前左侧文章解耦（重要）**：
    - **不按文章 / `documentKey` 绑定会话**：RAG 问答面向「当前登录用户知识库整体检索」，**在任意左侧打开的文章下**均可继续同一条 RAG 对话、继续未结束的流；切换文章**不得**因换篇而新建 RAG 会话或清空 RAG 消息。
    - **左侧编辑器无正文时仍允许 RAG 问答**：RAG 模式下 `ChatEntry` **不得**沿用 AI 模式的 `disableTextInput={!editorHasBody}`；占位符可单独文案（如「向知识库提问」），与 AI 模式「需先有正文」的约束**仅作用于 AI 模式**。
    - **左侧正文被清空时，不得清空 RAG 对话**：现有 AI 助手在 `knowledgeStore.markdown` 持续为空时会延迟清空输入框等逻辑；**RAG 模式不得**因 markdown 清空而清空 RAG store 中的 `messages`、不得重置 RAG 流状态。若需清空 RAG 历史，仅允许用户显式操作（本 SPEC 可不实现该按钮，但禁止隐式清空）。
  - **切换路由**、**切换到 AI 助手面板**都**不能停止 RAG 流输出**。
  - 从 AI 助手或其它页面切回 RAG 助手时：
    - 如果流还在输出，必须能继续看到正在输出的流式效果（打字机效果）。
  - RAG 问答调用后端接口：
    - `@apps/backend/src/services/knowledge-qa/knowledge-qa.controller.ts` 的 `ask`（SSE）接口。

---

## 2. 术语与对象

- **AI 助手**：现有的 `KnowledgeAssistant` + `assistantStore`，对齐后端 Assistant 模块；**按 `documentKey` 绑定会话**（与当前实现一致）。
- **RAG 助手**：新增的“知识库检索问答助手”，对齐后端 Knowledge QA（RAG）；**不按 `documentKey` 分桶**，全局（或按「用户 + 知识库入口」单一桶）一份对话与流状态即可。
- **documentKey**：与 Monaco `documentIdentity` 语义一致；**仅 AI 助手**用于绑定 `assistantStore` 会话；RAG 实现中可读取用于展示上下文（如可选展示当前标题），但**不得**作为 RAG 消息列表或 SSE 生命周期的分桶键。
- **canonicalKey**：**仅**在 AI 助手 / `assistantStore` 语境下使用；RAG 不要求与文章切换对齐的 canonical 分桶。

---

## 3. UI 设计（入口与交互）

### 3.1 入口位置

在 `KnowledgeAssistant.tsx` 内的：

- `ChatEntry` 的 `entryChildren` 区域，替换当前的 `<div></div>` 为“助手类型选择器”。
- 该选择器只影响当前 `KnowledgeAssistant` 面板内部渲染的“内容区（messages + send/stop）”所绑定的 store。

### 3.2 选择器形态

- 一个轻量的**分段切换**（Segmented Control）/ Tabs：
  - 选项 1：`AI 助手`
  - 选项 2：`RAG 助手`
- **默认值**：`AI 助手`
- **状态归属**：
  - 选择器状态建议保存在 `KnowledgeAssistant` 组件内（本地 UI 状态），并可选地同步到 `localStorage`（仅 UI 偏好，不影响业务）。
  - 切换不应触发任何 abort/stop 行为（两边都不应因“不可见”而中断流）。

### 3.3 切换时的可见性与并行流

- 切换到 `AI 助手`：
  - RAG 侧如果正在 stream：继续在后台更新其 store（不可见但持续更新）。
  - UI 不展示 RAG 的 messages，但在切回时应立刻呈现最新的增量。
- 切换到 `RAG 助手`：
  - AI 侧同理，保持 assistantStore 原行为。

> 说明：**不要求**同时在 UI 上展示两边的输出；要求是“不可见不等于停止”，store 必须持续接收流并累积消息内容。

---

## 4. 数据与状态设计（RAG 独立 store）

### 4.1 新增 store：`knowledgeRagQaStore`（名称建议）

新增一个与 `assistantStore` 并列的全局 MobX store，例如：

- 文件：`apps/frontend/src/store/knowledgeRagQa.ts`
- 默认导出单例：`export default knowledgeRagQaStore`
- 公开 API 可与 `AssistantStoreApi` **形似**（便于复用 UI 模式），但 **RAG 不按文章分桶**：

#### 必备字段（单一全局会话，不按 documentKey 分桶）

- **不推荐** `stateByDocument` / `activeDocumentKey` 作为 RAG 消息与流的维度；改为例如：
  - `messages: Message[]`（与现有 `@/types/chat` 的 `Message` 结构对齐，确保复用气泡组件）
  - `isSending: boolean`
  - `isStreaming: boolean`（可由 messages 中 isStreaming 派生，但建议保留 getter）
  - `abortStream: (() => void) | null`
  - `loadError: string | null`（可选）
  - `lastRunId: string | null`（可选：后端 `qa.start` 的 runId）
  - `lastEvidences: ...`（可选：最近一次 `qa.retrieval` / `qa.done` 的证据，用于 UI）

若未来需要「多 Tab 多份 RAG 会话」，可再扩展；**当前 SPEC 要求：与文章无关的一份全局 RAG 对话**。

#### 必备方法

- `sendMessage(question: string): Promise<void>`
  - 将 user 消息 push 进 `messages`
  - 创建一个 assistant 占位消息 `isStreaming: true`
  - 发起 SSE 请求到后端 `knowledge/qa/ask`
  - onDelta 时“替换对象”更新 assistant 消息（保持 MobX 订阅稳定）
  - onDone 时将 `isStreaming` 置为 false，并固化 `evidences`

- `stopGenerating(): Promise<void>`
  - 中止当前 RAG SSE（调用 `abortStream`）
  - **不得**误伤 `assistantStore` 的流

- `isStreaming(): boolean`（或等价 getter）
  - 供 UI 判断 RAG 是否在输出；**不**按 documentKey 查询。

> **不要求**实现 `activateForDocument` 对 RAG 的分桶；若保留空实现仅为与旧接口对齐，则须保证**无副作用**（不新建会话、不清消息、不 abort）。

### 4.2 与 `assistantStore` 的隔离要求

- `knowledgeRagQaStore` 不得复用 `assistantStore.messages`、`assistantStore.sessionByDocument` 等任何状态。
- **RAG 与 AI 的会话维度不同**：AI 仍按 `documentKey`/canonical 分桶；RAG 为全局单会话（与文章无关）。

---

## 5. SSE 协议与前端解析（对齐后端 `knowledge-qa`）

### 5.1 后端接口

- **接口**：`POST /api/knowledge/qa/ask`（SSE）
- **鉴权**：需要 token（与现有 API 请求方式一致）
- **请求体**（由后端 DTO 决定，至少包含）：
  - `question: string`
  - 可选：`topK?: number`
  - 可选：`includeEvidences?: boolean`

### 5.2 SSE 事件（后端 data payload）

后端会以 SSE `data: { ... }\n\n` 推送，典型事件：

- `qa.start`：包含 `runId`
- `qa.retrieval`：包含 `evidences[]`
- `qa.delta`：包含 `content`（增量）
- `qa.done`：包含 `evidences[]`
- `qa.error`：包含 `message`
- `qa.sse.done`：controller 追加的流结束标记

### 5.3 前端 SSE 工具：`streamKnowledgeQaSse`

新增工具（建议放在 `apps/frontend/src/utils/knowledgeRagQaSse.ts`），接口风格对齐 `streamAssistantSse`：

- 入参：
  - `body`：请求体
  - `callbacks`：
    - `onStart(runId)`
    - `onRetrieval(evidences)`
    - `onDelta(deltaText)`
    - `onDone(evidences)`
    - `onError(err)`
    - `onComplete(finalError?)`
- 返回值：`abort(): void`

实现要点（必须满足“切换路由不中断”）：

- `abort()` 只能由显式 stop 或 store 级替换流时调用；
- 组件卸载/切换面板不得自动调用 abort；
- 解析逻辑必须容忍：
  - `data:` 行拆包（buffer）
  - `[DONE]`/`qa.sse.done` 等结束语义

---

## 6. 视图层实现（在 `@apps/frontend/src/views/knowledge`）

### 6.1 改造点：`KnowledgeAssistant.tsx`

目标：不破坏原组件行为的前提下，把 UI 从“单一 assistantStore”升级为“可切换的双助手面板”。

#### 保持不变的部分（不能动现有语义）

- `assistantStore.activateForDocument(documentKey)` 的触发时机与条件（避免影响现有助手会话逻辑）。
- 现有 `assistantStore` 消息渲染、滚动贴底、代码悬浮工具条等行为在 AI 模式下必须完全一致。

#### 新增的部分

- 在 `entryChildren` 内加入“AI / RAG 切换器”。
- 在渲染 messages 区域时：
  - 当选择 `AI 助手`：渲染现有 `assistantStore.messages`
  - 当选择 `RAG 助手`：渲染 `knowledgeRagQaStore` 的 messages（建议复用同一套 `ChatAssistantMessage`/气泡组件）
- `ChatEntry` 行为按模式分支（**仅 RAG 模式放宽**，AI 模式保持现状）：
  - **AI 模式**：`placeholder`、`disableTextInput`、`loading`、`stopGenerating` 等与现有一致（仍依赖 `editorHasBody` 等）。
  - **RAG 模式**：`disableTextInput={false}`（或等价：始终可输入）；`placeholder` 使用 RAG 专用文案；**不**因 `knowledgeStore.markdown` 清空而清空 RAG 输入或 RAG 消息。
- `sendMessage`：
  - AI 模式：调用 `assistantStore.sendMessage(...)`（保持原逻辑）
  - RAG 模式：调用 `knowledgeRagQaStore.sendMessage(question)`
- `stopGenerating`：
  - AI 模式：调用 `assistantStore.stopGenerating()`（保持原逻辑）
  - RAG 模式：调用 `knowledgeRagQaStore.stopGenerating()`

### 6.2 与 documentKey、编辑器清空的关系

- **AI 助手**：继续仅在 `documentKey` / `editorHasBody` 等既有条件下 `activateForDocument`、`sendMessage`；现有「左侧清空延迟清空输入框」等逻辑**仅作用于 AI 模式**，行为不变。
- **RAG 助手**：
  - **不**因 `documentKey` 变化而重置 `knowledgeRagQaStore.messages` 或中断 SSE。
  - **不**监听 `knowledgeStore.markdown` 清空来清空 RAG 对话或 RAG 输入；用户切换文章、清空编辑器，RAG 侧历史与进行中的流保持不变（除非用户显式 stop 或后续产品增加「清空 RAG 对话」按钮）。

---

## 7. “切换不停止流”的验收标准（必须可验证）

### 7.1 面板切换

- 在 RAG 模式发送问题，出现流式输出（打字机）。
- 切到 AI 助手面板：
  - RAG 流式**继续在后台进行**（可通过回切观察到内容增长、或通过 store 状态判断）。
- 再切回 RAG：
  - 仍能看到**持续增长的流式输出**，不中断、不卡住、不丢字。

### 7.2 路由切换

- 在 RAG 模式发送问题，开始流式输出。
- 跳转到其它页面（路由切换导致组件卸载）。
- 立刻返回知识库页面，并切到 RAG 助手：
  - 若流仍在输出，必须继续展示输出过程；
  - 若流已完成，应看到最终完整消息与证据（如实现了 evidences 展示）。

### 7.3 不影响现有功能

以下行为必须与改动前保持一致（抽样验证）：

- 知识库保存/更新/另存为/覆盖保存/自动保存逻辑
- 回收站打开/预览/删除逻辑
- AI 助手现有的：
  - 会话绑定 documentKey
  - 流式输出
  - stop 按钮
  - 保存时 ephemeral flush 等逻辑

### 7.4 RAG 与文章、编辑器正文的专项验收

- 打开文章 A，在 RAG 下连续多轮问答；切换到文章 B（或新建草稿）：RAG **同一条**对话记录仍在，可继续提问；若文章 A 时有未结束流，切换后流仍在后台更新，回到 RAG 可见打字机延续。
- 左侧 `markdown` 为空：RAG 仍可输入并发送；后端按用户知识库检索，与当前编辑器是否有正文无关。
- 左侧执行清空/新建草稿等导致 `markdown` 变空：**仅** AI 侧仍按现有逻辑处理输入框；RAG store 的 `messages` **不得**被清空、**不得**因该 effect 被隐式 reset。

---

## 8. 风险与规避

- **风险：组件卸载时误 abort**  
  - 规避：abort 仅由 store 持有，组件不在 `useEffect cleanup` 中调用 stop。

- **风险：误把 RAG 按 documentKey 分桶，切换文章后用户以为「换了一篇 RAG 也换了」**  
  - 规避：RAG 使用全局单会话；切换文章只影响 AI 助手绑定，不影响 RAG store。

- **风险：复用「markdown 清空则清空输入」的 effect，误伤 RAG**  
  - 规避：该 effect 分支内判断当前模式为 AI 时才清空输入；且**禁止**对 `knowledgeRagQaStore.messages` 做任何联动清空。

- **风险：两套 store 争用同一份 input**  
  - 规避：输入框可共用，但发送时根据当前模式路由到不同 store；消息列表完全隔离。

---

## 9. 计划产物（后续要实现的文件清单）

> 本 SPEC 只描述实现，后续按本清单落代码。

- **新增**
  - `apps/frontend/src/store/knowledgeRagQa.ts`（RAG 独立 store）
  - `apps/frontend/src/utils/knowledgeRagQaSse.ts`（SSE 解析工具）
  - （可选）`apps/frontend/src/views/knowledge/KnowledgeRagAssistant.tsx`（把 RAG UI 从 `KnowledgeAssistant.tsx` 拆出来，降低耦合）

- **修改（最小侵入）**
  - `apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx`
    - 在 `entryChildren` 增加模式切换器
    - 根据模式绑定不同 store 的 messages/send/stop

