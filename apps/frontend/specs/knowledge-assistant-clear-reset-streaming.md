### Knowledge Assistant：清空内容与流式停止策略优化 SPEC

> 适用范围：知识库编辑页右侧通用助手（`apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx` + `apps/frontend/src/store/assistant.ts`）
>
> 目标：在**不影响现有功能**的前提下，优化“清空内容（按钮/⌘⇧D）”时是否调用后端 `/assistant/stop`、是否中断本地 SSE 展示、以及重新进入文章时的“打字机效果（流式继续输出）”体验。

---

## 1. 背景与问题陈述

当前知识页存在两类“清空/重置”动作：

- **未保存草稿**（典型：`draft-new`，且 `knowledgeAssistantPersistenceAllowed=false`）：助手走 ephemeral（临时态）SSE，不落库。
- **已保存条目**（知识库条目 / 回收站预览 / 本地 Markdown 条目等，通常 `knowledgeAssistantPersistenceAllowed=true`）：助手走持久化会话（sessionId + 落库）。

在旧实现中，清空内容会触发对助手状态的清理，并会调用 `stopAssistantStream(sessionId)` → `POST /api/assistant/stop`，从而把“清空内容”与“停止生成”耦合在一起。

你提出的优化诉求是：

- **未保存草稿清空内容时**：可以停止流式输出（终止本地展示，并可停止后端/前端生成，以免资源浪费与 UI 残留）。
- **已保存条目清空内容时**：**不要停止流式输出**，且在用户离开再重新进入该文章时，仍能看到正在输出的流式“打字机效果”。

同时必须满足约束：

- **不影响现有功能**（例如“停止生成”按钮仍需调用 `/assistant/stop`；切换文档不应打断其它文档的流式输出；草稿清空仍需清掉 ephemeral 对话以避免残留等）。

补充：为了让“新建未保存云端草稿（ephemeral）”也能停止后端侧的模型流式，本次实现新增了一个 **ephemeral stop 句柄 `streamId`**：

- 后端在 `ephemeral=true` 的 SSE 开始阶段下发 `meta` 事件携带 `streamId`
- 前端在清空/停止时用 `streamId` 调用 `/assistant/stop`（不会影响已有的 `sessionId` stop 语义）

---

## 2. 术语

- **SSE（Server-Sent Events，服务端推送事件）**：`POST /assistant/sse` 返回的流式文本协议。
- **stop 接口**：`POST /assistant/stop`，语义为停止一次正在进行中的生成：
  - 持久化模式：用 `sessionId` 停止
  - ephemeral（不落库）模式：用 `streamId` 停止
- **draft-new**：未保存云端草稿的绑定标识（示例：`draft-new__trash-{nonce}`）。
- **已保存条目**：拥有稳定知识条目 id 或稳定绑定（知识库条目、回收站预览、本地 Markdown 条目等）。
- **打字机效果**：正在进行的 SSE 增量持续 append 到 UI 消息气泡中，用户重新进入页面时仍看到增量变化。

---

## 3. 目标 / 非目标

### 3.1 目标

- **G1**：未保存草稿清空内容时，助手对话与流式输出应被清理/终止，避免残留与误绑定。
- **G2**：已保存条目清空内容时，不调用 `/assistant/stop`，不强制终止该条目的流式输出；用户重新进入该条目仍能观察到流式输出继续（打字机效果）。
- **G3**：不改变既有主流程语义：停止生成按钮、会话 hydrate、跨文档流式并存、首次保存迁入等逻辑保持一致。

### 3.2 非目标

- 不在本 SPEC 内重做后端协议或引入新的后端推送“可断点续流”能力。
- 不在本 SPEC 内改变消息持久化的时机（例如 stop 是否强制落库）——仅约束前端何时调用 stop、何时清本地 state。

---

## 4. 当前实现（以代码为准的关键点）

### 4.1 清空内容触发链路（知识页）

- 知识页清空标题/正文的动作会调用 `resetEditorToNewDraft()`（位于 `apps/frontend/src/views/knowledge/index.tsx`）。
- 该函数会根据“助手是否允许持久化（assistantPersistenceAllowed）”决定是否清理助手：
  - `assistantPersistenceAllowed=false`（新建未保存云端草稿，ephemeral）：会调用 `assistantStore.clearAssistantStateOnKnowledgeDraftReset(nextAssistantDocumentKey, { stopBackend: true })`
  - `assistantPersistenceAllowed=true`（知识库/回收站/本地条目）：不会清理对应 assistant 桶，也不会 stop（保证重进可见打字机效果）

### 4.2 `clearAssistantStateOnKnowledgeDraftReset` 的行为

`assistantStore.clearAssistantStateOnKnowledgeDraftReset` 的关键职责是：

- 中断前端 SSE（`abortStream`）
- 删除当前文档桶的内存 state（messages/session 映射）
- 可同步 `activeDocumentKey`
- **优化后实现**：默认不调用后端 stop；仅当显式传入 `options.stopBackend === true` 时，才会调用 `/api/assistant/stop`：
  - 若当前桶存在 `sessionId`：`stopAssistantStream({ sessionId })`
  - 否则（ephemeral）若已收到 `streamId`：`stopAssistantStream({ streamId })`

---

## 5. 期望行为矩阵（新规格）

以“清空内容”动作为中心，定义不同文档类型下的行为：

| 场景 | 是否中断本地 SSE（abort） | 是否清空本地 assistant state（messages/session 映射） | 是否调用后端 `/assistant/stop` | 重新进入该条目是否能看到打字机效果 |
| --- | --- | --- | --- | --- |
| **未保存草稿（draft-new，ephemeral）清空** | ✅ 是 | ✅ 是 | ✅（可选，见 §6.2；默认建议是） | ❌ 不需要（对话被清掉） |
| **已保存条目清空** | ❌ 否 | ❌ 否（至少不应删除该条目的 state） | ❌ 否 | ✅ 需要（继续输出） |

说明：

- “已保存条目清空”这里的“清空”是指**清空左侧编辑器内容**或重置编辑态，不应被解释为“停止助手生成”。
- 为了让“重新进入仍打字机”，前端必须保留该条目的流式连接与 state（或至少能继续消费增量并渲染）。

---

## 6. 设计方案

### 6.1 总体策略：把“清空内容”与“停止生成”解耦

将清空动作拆成两种语义：

- **草稿重置（Draft Reset）**：只适用于未保存草稿（draft-new）。需要清理助手 ephemeral 对话，并终止其流式展示。
- **已保存条目清空编辑器内容（Editor Clear for Persisted Article）**：仅清空编辑器内容，不应触发助手 stop 或清理助手桶 state。

### 6.2 Store API：为清空动作引入“策略参数”（显式语义）

`assistantStore.clearAssistantStateOnKnowledgeDraftReset` 需要带“策略参数”，以便调用方显式表达语义（示例签名，允许按实现调整）：

```ts
clearAssistantStateOnKnowledgeDraftReset(
  syncActiveDocumentKey?: string | null,
  options?: {
    /**
     * 是否通知后端 stop（/assistant/stop）。
     * - ephemeral（未保存云端草稿）清空：建议 true（避免后端继续跑、也减少资源浪费）
     * - 已保存条目清空：必须 false
     */
    stopBackend?: boolean;
  }
): void
```

约束：

- **默认行为应与“当前调用方语义”一致**：只有“草稿重置”入口才会调用该方法，且默认可按 draft 的需要 stop。
- 已保存条目的“清空编辑器内容”动作不应调用该方法（或必须传 `stopBackend:false` 且不删除 state）。

> 注：如果现有业务需要“清空时必须删除桶 state”，应增加更细粒度的策略枚举（例如 `mode: 'draftReset' | 'persistedClear'`），以免单靠 `stopBackend` 无法表达“是否删除 state”。

### 6.3 UI/调用方改造：仅在 ephemeral 草稿清空时清助手并 stop

在知识页（`apps/frontend/src/views/knowledge/index.tsx`）清空逻辑中，调用方应根据“当前条目是否为未保存草稿”来选择行为：

- 若 `assistantPersistenceAllowed=false`（典型：新建未保存云端草稿，ephemeral）：
  - 调用 `assistantStore.clearAssistantStateOnKnowledgeDraftReset(nextKey, { stopBackend: true })`
  - 终止并清理 ephemeral 对话
- 若当前是 **已保存条目（含回收站预览）**：
  - **不调用** `clearAssistantStateOnKnowledgeDraftReset`
  - 仅清空编辑器内容（以及与编辑器相关的 nonce/identity），保持助手桶 state 与流式继续

其中 `assistantPersistenceAllowed` 的判定规则与 `KnowledgeAssistant.tsx` 对齐：

- 回收站预览（`knowledgeTrashPreviewId != null`）→ `true`
- 本地 Markdown 条目（`isKnowledgeLocalMarkdownId(editingId)`）→ `true`
- 已绑定云端知识条目 id（`editingId` 真值）→ `true`
- 否则 → `false`（新建未保存云端草稿）

### 6.4 重新进入文章的“打字机效果”保障

为满足“重新进入仍打字机”：

- 切换文档（`activateForDocument`）必须继续遵守“不 abort 其它文档流式”的原则（当前实现已强调此点）。
- 对已保存条目，不应因“清空编辑器内容”而删除该条目的 assistant state（messages/abortStream 等），否则无法继续增量渲染。
- UI 重新进入时仍使用相同的 `documentKey`（或 canonicalKey 后一致的桶 key）指向同一桶 state。

---

## 7. 兼容性与不影响现有功能的约束点

- **停止生成按钮**：
  - 仍使用 `assistantStore.stopGenerating()`：
    - 有 `sessionId`：调用 `/assistant/stop` 携带 `{ sessionId }`（语义不变）
    - 无 `sessionId` 且已收到 `streamId`：调用 `/assistant/stop` 携带 `{ streamId }`（新增能力，不影响原逻辑）
- **未保存草稿的清空**：
  - 必须仍能彻底清掉 ephemeral 消息与流式状态，避免 UI 残留影响下一篇草稿。
- **跨文档流式并存**：
  - 切换文档不应打断其它文档的 SSE（现有设计原则不变）。
- **首次保存迁入**：
  - 与 `pendingEphemeralFlush`、`flushEphemeralTranscriptIfNeeded` 的规则保持一致，不在本 SPEC 内改变。

---

## 8. 验收清单（建议）

- **A1 草稿清空**：
  - 新建未保存云端草稿（ephemeral）在流式过程中点击清空或 ⌘⇧D：
    - 前端 SSE 被 abort（立即停止打字机）
    - 若已收到 `streamId`，会调用 `/assistant/stop` 携带 `{ streamId }`（停止后端流）
    - 助手气泡被清空；不会把残留对话迁入后续保存条目
- **A2 已保存条目清空**：
  - 已保存条目正在流式输出时点击清空或 ⌘⇧D：不调用 `/assistant/stop`，右侧助手流式仍在继续（可能暂时不可见，取决于 UI 是否仍展示助手面板）。
  - 用户离开该条目并重新进入：仍可看到该条目当前正在输出的“打字机效果”继续变化。
- **A3 停止生成按钮不变**：
  - 点击停止生成：仍调用 `/assistant/stop`，流式停止，UI 状态结束。

---

## 9. 实现提示（非强制）

- “是否为 draft-new”建议在调用方（知识页）判断，因为它最接近编辑器清空语义（重置草稿 vs 清空已保存内容）。
- Store 层应避免在“清空内容”这种编辑器行为里默认触发 stop；stop 应尽量只由“停止生成”交互触发。

