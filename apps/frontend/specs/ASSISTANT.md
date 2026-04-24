### Knowledge Assistant（知识库右侧助手）SPEC

本 SPEC 以当前代码实现为准，覆盖 `apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx` 及其依赖的 `assistantStore`、SSE（Server-Sent Events，服务端推送事件）协议、消息渲染与操作区交互、以及“未保存草稿 ephemeral（临时态）对话 → 首次保存后迁入持久化会话”的完整链路。

---

### 1. 目标与范围

- **目标**：在知识库编辑页右侧提供一个“通用助手”，围绕“当前文档正文”进行多轮对话、流式生成、快捷总结/润色，并在适当条件下将会话与知识条目绑定并持久化到服务端。
- **范围**：
  - **UI**：消息列表、输入框、空态快捷卡片、流式贴底、滚动角落按钮、复制/保存到知识文档、停止生成。
  - **状态与会话**：按 `documentKey` 维度隔离会话与流式状态；支持文档切换时不打断其它文档流式输出。
  - **持久化策略**：已保存条目/本地条目/回收站预览允许落库；新建未保存云端草稿禁落库，改为 ephemeral SSE；首次保存后迁入。
  - **协议**：消费后端 `/assistant/sse` 行协议（`data: JSON`），支持 `content`/`thinking`/`usage`/`done`/`error`。

---

### 2. 核心概念与术语

- **documentKey**：与左侧 MarkdownEditor 的 `documentIdentity` 保持一致，用于绑定右侧助手的“文档维度会话”。知识区约定为 `"{binding}__trash-{nonce}"`。
- **canonicalKey（规范化 key）**：从 `documentKey` 中去除回收站分栏相关的 `__trash-*` 后缀，得到稳定条目标识，用于**会话与流式绑定**，避免因 nonce 变化导致同一条目出现多份空 state。
- **assistantArticleBinding**：知识条目绑定标识，规则见 `knowledgeAssistantArticleBinding()`：
  - 回收站预览优先：`__knowledge_trash__:{trashId}`
  - 否则为当前编辑 id
  - 若无编辑 id：`draft-new`
- **persistence（持久化）**：
  - **允许持久化**：助手可以创建 session、拉历史、把消息存到服务端会话。
  - **不允许持久化**：不创建 session、不落库；用 ephemeral SSE 进行生成；并在首次保存成功后将对话“迁入”到服务端会话。
- **ephemeral（临时态）**：`knowledgeAssistantPersistenceAllowed=false` 时的会话模式；请求体包含 `ephemeral: true` 与 `contextTurns`（最近 120 轮上下文）。
- **import-transcript（迁入对话）**：首次保存后调用 `/assistant/session/import-transcript` 把内存消息迁入后端（最多 200 条，取最近窗口）。
- **thinking（思考过程）**：SSE 中 `type: "thinking"` 的增量文本，存入 `message.thinkContent`，在气泡里可展开显示。

---

### 3. 用户入口与可见功能点

#### 3.1 展示与空态

- **历史加载态**：`assistantStore.isHistoryLoading=true` 时显示 `Loading("正在加载对话…")`。
- **无消息空态**（`messages.length===0`）：
  - **左侧文档有正文**：展示两张快捷卡片（同 `KNOWLEDGE_ASSISTANT_PROMPTS`）：
    - `润色文档内容`
    - `总结文档内容`
  - **左侧文档无正文**：展示欢迎文案（不可输入/不可发送）。

#### 3.2 输入框与发送

- **登录要求**：未登录不展示输入框区域（UI 层直接 `isLoggedIn ? <ChatEntry/> : null`）；发送时也会二次校验并 Toast。
- **正文要求**：左侧编辑器无正文时：
  - 输入框禁用：`disableTextInput=true`
  - placeholder：`请先在左侧编辑器输入正文后再向我提问`
  - 且当 markdown 持续为空 200ms 后会清空输入框草稿，避免残留（同时规避编辑器重挂载的瞬态空串）。
- **发送行为**：
  - 发送时清空输入框
  - 开启“流式贴底”
  - 调用 `assistantStore.sendMessage(text)`（普通发送）或 `assistantStore.sendMessage(userMessageShort, { extraUserContentForModel })`（快捷卡片发送）

#### 3.3 快捷卡片（总结/润色）

- 触发条件：必须登录、必须有正文、且当前不在 `isSending / isHistoryLoading / isStreaming`。
- UI 展示：
  - **无消息时**：以“卡片”形式展示（含 icon、标题、描述）。
  - **有消息且流式结束后**：以“条带按钮”形式跟在消息列表末尾展示（同样的两个动作）。
- 请求构造：
  - 气泡中的用户消息显示为短标题（`userMessageShort`）：
    - `润色文档内容` 或 `总结文档内容`
  - 发送给模型的额外内容 `extraUserContentForModel`：
    - 包含“当前知识库文档全文”分隔块
    - **仅用于模型上下文，不入库**（由后端拼到 user 消息上下文中）

#### 3.4 消息气泡操作

- 每条消息底部操作条（`ChatMessageActions`）：
  - **复制**：复制 `message.content` 到剪贴板；500ms 内显示已复制态。
  - **保存到知识文档**（助手消息才有）：将助手回复追加写入 `knowledgeStore.markdown` 末尾，并 Toast 成功；无正文则 warning。
  - 本场景关闭分享：`needShare={false}`。

#### 3.5 停止生成

- 流式生成中，输入区右侧按钮变为“停止”：
  - 点击触发 `assistantStore.stopGenerating()`：
    - 先 abort SSE（防止继续 apply delta）
    - 将所有 `isStreaming` 消息置为 `isStreaming=false` 且 `isStopped=true`
    - 若存在 sessionId，则请求 `/assistant/stop`（无进行中可能失败，忽略）

#### 3.6 滚动与贴底体验

- **流式贴底**：流式阶段自动滚到底部（由 `useStickToBottomScroll` 统一管理）。
- **滚动角落按钮**（右下角 FAB）：
  - 当内容高度可滚动时出现
  - 触底时显示“滚到顶部”（ChevronUp）
  - 未触底时显示“滚到底部”（ChevronDown）
  - 点击“滚到顶部”会先解除贴底（否则会被流式贴底逻辑拉回底部）
- **流式结束后的条带插入**：由于条带会改变 `scrollHeight`，会在 `useLayoutEffect` 中布局后补两次贴底（含 `requestAnimationFrame`），避免用户停在旧位置。

---

### 4. 状态模型与数据结构

#### 4.1 Message（消息结构）

使用 `@/types/chat` 的 `Message`（关键字段）：

- **chatId**：消息唯一 id（UI 侧也用于 key）
- **role**：`user | assistant | system`
- **content**：消息正文（assistant 流式拼接）
- **thinkContent**：思考过程增量文本（可选）
- **isStreaming**：是否仍在流式输出
- **isStopped**：是否人为停止
- **searchOrganic**：联网检索结果（本知识助手链路当前不注入，但渲染组件支持）

#### 4.2 AssistantStore 的“按文档隔离”状态

`assistantStore` 以 **canonicalKey(documentKey)** 作为索引保存 state：

- `stateByDocument[canonicalKey]`：
  - `sessionId`
  - `messages`
  - `isHistoryLoading`
  - `isSending`
  - `abortStream`：最近一次 SSE 的 abort 函数（仅该文档 state）
  - `historyHydrated`：是否已 hydrate 过（避免反复 activate 重复请求）
  - `pendingEphemeralFlush`：首次保存但仍在流式时的“延迟迁入”任务
- `activeDocumentKey`：当前 UI 指针（注意：只是指针，不等于 state key）
- `sessionByDocument[canonicalKey]`：文档→sessionId 的缓存映射

#### 4.3 “消息版本戳”与流式渲染稳定性

- 单条气泡组件 `KnowledgeAssistantMessageBubble` 是独立 `observer`，并在外层节点绑定 `data-msg-rev`：
  - assistant：`content.length : thinkContent.length : isStreaming`
  - user：`content.length`
- 目的：保证 MobX 在流式阶段对这些字段的订阅稳定，避免只订阅到对象引用却不随增量刷新。

---

### 5. 生命周期与关键流程

#### 5.1 文档切换激活（activateForDocument）

触发：`KnowledgeAssistant` 监听 `documentKey` 与 `editorHasBody`。

流程要点：
- 当 `documentKey` 变化时，总是调用 `assistantStore.activateForDocument(documentKey)`，其内部会：
  - 写入 `activeDocumentKey`
  - 确保 `stateByDocument[canonicalKey]` 存在
- 若当前 `assistantStore.activeDocumentKey === documentKey` 且编辑器无正文（空串），会跳过 activate，避免在“清空草稿后”重复激活导致二次清空/误拉会话。

持久化条件：
- 若 `knowledgeAssistantPersistenceAllowed=false`：activate 只做指针切换，不拉历史、不建 session。
- 若无 token：不拉历史（避免未登录请求）。
- 若 `historyHydrated=true`：不重复请求。

历史拉取策略（允许持久化时）：
- 优先按文档绑定 id 调 `GET /assistant/session/for-knowledge` 拉会话与消息（可一次 hydrate）。
- 若拿到 sessionId 则写入 `sessionByDocument`、`state.sessionId`、`state.messages`。
- 否则若已有 sessionId，再调 `GET /assistant/session/:sessionId` 拉全量消息。
- 若后端返回 `session: null`（会话被删除）：清掉本地缓存映射与 state。

#### 5.2 允许持久化（knowledgeAssistantPersistenceAllowed）判定

UI 层计算 `assistantPersistenceAllowed`：
- 回收站预览存在：true
- 当前编辑条目是本地 Markdown（`__local_md__:` 前缀）：true
- 当前编辑条目存在（云端 id）：true
- 否则（新建未保存云端草稿）：false

并在组件 mount/unmount 时设置回 `assistantStore`：
- mount：写入当前 allowed
- unmount cleanup：恢复为 true（避免影响其它页面/场景）

#### 5.3 发送消息（sendMessage）

入口：`assistantStore.sendMessage(raw, options?)`

前置校验：
- `activeDocumentKey` 为空：Toast `文档未就绪`
- `raw` 为空或当前 `isSending/isHistoryLoading`：直接 return
- `ephemeral=false`（允许持久化）时：
  - `ensureSessionForCurrentDocument()`：
    - 未登录：Toast `请先登录后再使用助手`
    - 创建 session：`POST /assistant/session`（可带 `knowledgeArticleId`）
  - 拿到 `sessionId` 后继续
- `ephemeral=true`（不允许持久化）时：
  - 仍要求 token；否则 Toast `请先登录后再使用助手`

消息入列（立即渲染）：
- 生成 `userChatId`、`assistantChatId`（uuid）
- push 两条消息：
  - user：正文为用户输入
  - assistant：`content=''`、`isStreaming=true`、`thinkContent=''`

流式拼接策略：
- 维护 `accumulated` 与 `thinkBuf`
- SSE 每个增量会用“替换数组元素为新对象”的方式更新（避免原地 mutate 引发订阅/渲染不一致）

完成回调：
- `onComplete(err?)`：
  - 标记 `isSending=false`
  - 将 assistant 消息置 `isStreaming=false`
  - 若 `err`：
    - `content` 为空时写入 `生成失败：{err}`
    - 标记 `isStopped=true`
  - 若存在 `pendingEphemeralFlush` 且当前 state 已无流式消息：执行迁入（见 5.4）
  - 若无错误且 `ephemeral=false`：尝试刷新一次服务端消息（以服务端为准补齐/对齐）

错误回调：
- `onError(e)`：
  - `isSending=false`
  - assistant 消息 `isStreaming=false`，`content` 为空时写入 `e.message`
  - 清空 `pendingEphemeralFlush`（避免把不完整内容绑定到新条目）

#### 5.4 草稿首次保存后的迁入（flushEphemeralTranscriptIfNeeded）

场景：新建云端草稿未保存（`persistenceAllowed=false`）期间产生了多轮对话；首次保存成功后需要把对话写入正式条目会话中。

两种策略：

- **立即迁入**：保存成功时调用 `flushEphemeralTranscriptIfNeeded(cloudArticleId, fromKey, toKey)`：
  - 从内存 `messages` 构建 `lines`：
    - 仅 `user/assistant`
    - 保留“未结束流式时已生成片段”
    - 最多 200 条（取最近窗口，保持时间顺序）
  - `POST /assistant/session/import-transcript`，返回 `sessionId`
  - 更新映射：
    - 删除 from 映射，写入 to 映射
    - `toState.sessionId=sessionId`
    - 标记 hydrate 完成，清空 pending
    - 若 active 指针仍指向 fromKey，则切到 toKey

- **延迟迁入**：若保存时仍在流式输出（避免迁入不完整对话）：
  - 调用 `scheduleEphemeralFlushAfterStreaming()` 登记 `pendingEphemeralFlush`
  - 并把 `historyHydrated=true`，避免保存后 activate 拉取“服务端空历史”覆盖 UI
  - 在流式结束（`onComplete`）且确认无任何流式消息后，自动执行 `flushEphemeralTranscriptIfNeeded`

重要约束：
- 发生 SSE 错误时不会自动迁入；若产品需要“错误也迁入”，应改为 UI 层由用户确认后再迁入。

---

### 6. SSE 协议（/assistant/sse）

客户端实现：`streamAssistantSse()`，以 `POST` 发起，读取 `response.body.getReader()`，按 `\n` 拆行，消费形如 `data: {json}` 的行。

#### 6.1 请求

- URL：`POST {BASE_URL}/assistant/sse`
- Header：
  - `Authorization: Bearer {token}`
  - `Content-Type: application/json`

Body（两种模式）：

- **持久化模式**（ephemeral=false）：
  - `sessionId: string`
  - `content: string`
  - `extraUserContentForModel?: string`

- **ephemeral 模式**（ephemeral=true）：
  - `ephemeral: true`
  - `content: string`
  - `extraUserContentForModel?: string`
  - `contextTurns?: Array<{role:'user'|'assistant', content:string}>`（最多 120 轮；排除末尾空占位助手消息）

#### 6.2 响应事件

每条事件为一行 JSON（示意）：

- **增量正文**：`{ "type": "content", "content": "..." }`
  - 触发 `onDelta(content)`
- **增量思考**：`{ "type": "thinking", "raw": "..." }` 或 `{ "type":"thinking", "content":"..." }`
  - 触发 `onThinking(text)`
- **用量**：`{ "type": "usage", ... }`
  - 客户端忽略
- **完成**：`{ "done": true }`
  - 触发 `onComplete()`
- **错误**：`{ "error": "..." }`
  - 触发 `onComplete(error)`

异常处理：
- JSON 解析失败：Toast `助手流解析失败`，继续读流（不终止）。
- 401：触发 `notifyUnauthorized()`，并抛出 `请先登录后再试`。
- Abort（用户停止/切换导致）：视为正常完成，走 `onComplete()`。

---

### 7. UI 细节与交互规格

#### 7.1 列表与布局

- 消息列表使用 `ScrollArea`，内容容器限制最大宽度 `max-w-3xl`，并确保 `min-w-0` 防止代码块撑破布局。
- 每条气泡支持：
  - 用户消息：右对齐、浅 teal 背景
  - 助手消息：左对齐、theme 背景
- 操作条位置：通过 `ChatMessageActions` 绝对定位到气泡底部外侧（`-bottom-9`）。

#### 7.2 粘底与滚动按钮

- 粘底开启时，流式增量会自动滚动到底部；用户手动滚动离底则会切换 FAB 为“回到底部”。
- FAB 显隐阈值：
  - `maxScroll <= 4`：隐藏
  - 否则：
    - `scrollTop >= maxScroll - 8`：显示“到顶部”
    - 否则显示“到底部”

#### 7.3 输入框清空防抖

当左侧 markdown 为空时不会立刻清空输入，而是延迟 200ms 再检查一次是否仍为空，避免 Monaco 重挂载造成的瞬态空串误清。

---

### 8. 性能与渲染策略（关键实现约束）

#### 8.1 流式渲染与 MobX 订阅稳定性

- `assistantStore` 流式增量更新采用“替换数组元素为新对象”的策略：
  - 保证 observable 数组在元素级发生变更，列表子 observer 能稳定刷新。
- `KnowledgeAssistantMessageBubble` 额外使用 `data-msg-rev` 强化订阅字段的可追踪性。

#### 8.2 Markdown 富文本渲染的懒挂载

`ChatAssistantMessage` 内部针对富文本预览做了“进视口才挂载”的策略（IntersectionObserver + 预判），避免大量历史消息导致主线程卡死。知识助手通过传入 `scrollViewportRef` 启用该模式（助手消息一侧传 ref）。

---

### 9. 错误提示与 Toast 规范

#### 9.1 用户侧可见提示（来自 UI/Store）

- 未登录：
  - 发送时：`请先登录后再使用助手`
  - SSE 401：`请先登录后再试`（并触发全局未授权处理）
- 无正文：
  - 快捷卡片：`请先在左侧编辑器输入正文`
  - 输入框 placeholder：`请先在左侧编辑器输入正文后再向我提问`
- 文档未就绪（`activeDocumentKey` 为空）：`文档未就绪`
- 保存到知识文档无内容：`没有可写入的正文`
- SSE 行解析失败：`助手流解析失败`

#### 9.2 迁入失败

- `import-transcript` 或相关接口失败时不弹额外 Toast（由 http 层统一处理或静默失败），但需要保证 UI 不被覆盖/清空。

---

### 10. 服务端接口契约（前端依赖）

#### 10.1 会话（session）

- `POST /assistant/session`：创建会话
  - 入参：`{ title?, knowledgeArticleId? }`
  - 出参：`{ sessionId, title }`
- `GET /assistant/session/:sessionId`：拉取会话详情与消息（时间正序）
  - 出参：`{ session: {...} | null, messages: [...] }`
- `GET /assistant/session/for-knowledge?knowledgeArticleId=...`：按知识条目获取最近绑定会话与消息
  - 出参：同上或 `null`
- `PATCH /assistant/session/:sessionId/knowledge-article`：会话改绑条目
  - 入参：`{ knowledgeArticleId }`
  - 出参：`{ sessionId, knowledgeArticleId }`

#### 10.2 迁入对话

- `POST /assistant/session/import-transcript`
  - 入参：
    - `knowledgeArticleId: string`
    - `lines: Array<{ role:'user'|'assistant', content:string }>`（最多 200）
  - 出参：`{ sessionId, inserted }`

#### 10.3 流式生成与停止

- `POST /assistant/sse`：SSE 行协议，见第 6 节
- `POST /assistant/stop`：停止当前会话生成
  - 入参：`{ sessionId }`
  - 出参：`{ success, message }`

---

### 11. 与知识编辑器的联动契约

- `documentKey` 必须始终与知识页的 `knowledgeAssistantDocumentKey(binding, trashOpenNonce)` 规则一致：
  - 切换回收站分栏 nonce 不应导致会话丢失（由 canonicalKey 去后缀保证）。
- 草稿清空/重置时：
  - 外部应调用 `assistantStore.clearAssistantStateOnKnowledgeDraftReset(syncActiveDocumentKey?)`：
    - 中断流式
    - 清空当前文档 state 与 session 映射
    - 可同步 `activeDocumentKey`，避免触发二次 activate 拉取
- 首次保存云端条目时（从草稿到正式 id）：
  - 若当时仍在流式：登记 `scheduleEphemeralFlushAfterStreaming()`
  - 否则：立即 `flushEphemeralTranscriptIfNeeded()`
  - 并在保存后对 `documentKey` 做 remap：`assistantStore.remapAssistantSessionDocumentKey(fromKey, toKey)`（避免历史丢失）

---

### 12. 验收清单（与现实现一致）

- **基础**：
  - 登录后可发送消息并流式展示
  - 未登录不显示输入框，点击快捷卡片/发送会 Toast
- **文档约束**：
  - 左侧无正文时输入框禁用、placeholder 正确、快捷卡片不可用
  - 左侧正文被清空后 200ms 输入框内容会被清掉
- **快捷卡片**：
  - 无消息时展示两张卡片；有消息且流式结束后在列表尾部显示条带按钮
  - 点击后用户气泡显示短标题，但模型可拿到全文（extraUserContentForModel）
- **滚动体验**：
  - 流式阶段自动贴底
  - 可滚动时出现 FAB，能平滑滚到顶/底；滚到顶时会解除贴底避免被拉回
- **消息操作**：
  - 复制按钮 500ms 已复制态
  - 助手消息可“保存到知识文档”，会把内容追加到 markdown 并 Toast 成功
- **持久化/迁入**：
  - 新建未保存云端草稿：不创建 session、不拉历史，走 ephemeral SSE
  - 首次保存后能把对话迁入并绑定到新条目会话（最多 200 条）
  - 若保存时仍在流式，迁入会在流式结束后自动执行
- **停止生成**：
  - 点击停止后不再追加 delta，流式状态结束，后端 stop 被调用（有 sessionId 时）

