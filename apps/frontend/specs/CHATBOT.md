### ChatBot（企业级聊天模块）SPEC

本 SPEC 以当前实现为准，覆盖 `apps/frontend/src/views/chat/*` 以及其依赖的聊天连接层 `ChatBot`、纯渲染层 `ChatBotView`、核心业务 Hook `useChatCore`、状态存储 `chatStore`、流式协议 `streamFetch`、附件上传、联网搜索开关、会话管理与分享链路。目标是把“实现即规范”沉淀为可验收、可扩展、可维护的企业级规格说明。

---

### 1. 模块边界与目录结构

#### 1.1 路由与页面入口（views/chat）

- **`/chat`**：新会话页（`apps/frontend/src/views/chat/new/index.tsx`）
  - 进入时强制 `clearChat()`，防止复用上次 `sessionId` 继续追加到旧会话。
- **`/chat/c/:id`**：会话详情页（`apps/frontend/src/views/chat/session/index.tsx`）
  - 刷新后 store 为空时按需拉取会话消息 `getSession(id)` 并 hydrate。
- **`/chat` 容器**：主容器（`apps/frontend/src/views/chat/index.tsx`）
  - 顶部按钮：历史会话抽屉、分享入口
  - 中间 `<Outlet/>`：渲染 new/session 页面
  - 底部：输入区或分享勾选条
  - 弹层：历史会话抽屉、创建分享链接弹窗

#### 1.2 关键组件与职责划分

- **`ChatEntry`**：底部输入区（文本域、附件、发送、停止、联网搜索开关、新对话）。
- **`ChatBot`（连接层）**：默认业务实现入口，负责把 store/context/hook 绑定到 `ChatBotView`。
- **`ChatBotView`（纯渲染层）**：消息列表 + 分支/滚动/锚点/操作区的“可复用 UI 壳”，由 props 驱动。
- **`useChatCore`**：聊天业务核心（创建会话、构建消息树、发送 SSE、回滚、停止、继续生成、继续回答）。
- **`chatStore`**：会话与消息存储（消息列表、流式缓冲节流、分支选择持久化、停止状态、finishReason、历史会话分页）。
- **`ChatCoreProvider`**：跨组件共享的 ref 与 UI 状态（停止函数、快照、是否收到流式、当前 assistantId、分享勾选、联网开关）。

---

### 2. 数据模型（Message / Session）与消息树

#### 2.1 Message 字段（核心）

使用 `apps/frontend/src/types/chat.ts` 的 `Message`（重要字段）：

- **标识与关系**
  - `chatId`: string（消息 id，UI key）
  - `parentId?`: string（父消息 chatId）
  - `childrenIds?`: string[]（子消息 id 列表，用于多分支）
  - `currentChatId?`: string（“当前可见链尾 chatId”的快照，用于请求体/回滚定位）
- **内容**
  - `role`: 'user' | 'assistant' | 'system'
  - `content`: string
  - `thinkContent?`: string（思考过程）
  - `attachments?`: UploadedFile[] | null（附件）
  - `searchOrganic?`: SearchOrganicItem[] | null（联网检索网页摘要/引用）
- **状态**
  - `isStreaming?`: boolean（是否流式输出中）
  - `isStopped?`: boolean（UI 读停止态；实际权威由 `chatStore.stoppedMessages` Map 管理）
  - `finishReason?`: { reason: 'length' | 'stop' | null; maxTokensReached: boolean; sessionId: string }
- **分支元数据（展示用）**
  - `siblingIndex?` / `siblingCount?`：`buildMessageList()` 在展示链上计算出的“当前兄弟序号/总数”

#### 2.2 Session 字段（视图依赖）

`Session`（`types/chat.ts`）：
- `id`、`title`、`createdAt/updatedAt`
- `messages`: Message[]（该会话的全量消息树 flat 列表）

#### 2.3 消息树与“当前分支链”推导

- Store 存储的是 **flatMessages（全量树）**：`chatStore.messages`
- UI 展示的是 **displayMessages（单链）**：由 `buildMessageList(flatMessages, selectedChildMap)` 推导
  - `selectedChildMap` 的 key：
    - `'root'`：根层多条 user 消息的选择
    - 其它：父消息 `chatId` → 当前选中的子消息 `chatId`
  - 若某层未在 map 里选择，默认取该父节点 `childrenIds` 的最后一个（即最新追加的 child）
  - 根层多条消息会按时间排序，默认取最后一个根消息为展示起点

---

### 3. 状态与共享上下文（ChatCoreProvider）

`apps/frontend/src/contexts/index.tsx` 提供跨 chat 页面/组件共享的上下文，关键点：

- **请求控制**
  - `stopRequestMapRef: Map<sessionId, abortFn>`：保存每个会话当前 SSE 的 abort 函数
  - `requestSnapshotMapRef: Map<sessionId|'new', RequestSnapshot>`：发送前快照（用于“未收到任何流式数据时停止/错误”回滚）
  - `hasReceivedStreamDataMapRef: Map<sessionId, boolean>`：是否收到过流式增量（区分“立即停止不落内容” vs “已生成部分内容停止”）
  - `currentAssistantMessageMapRef: Map<sessionId, assistantMessageId>`：本次请求对应的 assistant 消息 id
- **滚动联动**
  - `onScrollToRef: ((position, behavior?) => void) | null`：由 `ChatBotView` 注册，供 `useChatCore.sendMessage` 触发“发送后滚底”
- **分享模式**
  - `isSharing`、`checkedMessages: Set<string>`、`setCheckedMessage()`、`setAllCheckedMessages()`、`clearAllCheckedMessages()`、`isAllChecked()`
  - 约定：分享选择以“对话组”为单位（user + assistant 成对切换），`checkedMessages.size / 2` 显示已选择组数
- **联网搜索开关**
  - `webSearchEnabled`：与 `ChatEntry`、`useChatCore` 共用，避免状态分裂

---

### 4. 会话管理（创建/加载/列表/删除/改名）

#### 4.1 创建或获取会话 id

业务入口：`useChatCore.getSessionInfo()`：
- 调用 `createSession(chatStore.activeSessionId)`（后端可复用传入 id 或创建新 session）
- 成功后写入 `chatStore.activeSessionId`
- 若发送时当前没有 `sessionId`，会先创建会话；首轮发送可触发路由跳转到 `/chat/c/{sessionId}`

#### 4.2 刷新后加载会话详情

`views/chat/session/index.tsx`：
- 仅当：
  - 有 `params.id`
  - `chatStore.messages.length === 0`（刷新后 store 空）
  - `chatStore.sessionData.total === 0`（避免进入“空 session 无对话”的误请求）
- 才调用 `getSession(id)` 并 `chatStore.setAllMessages(res.data.messages, id, false)`

#### 4.3 历史会话抽屉（分页 + 滚动加载）

`chatStore` 内置历史分页（与知识库一致的体验）：
- `pageSize=20`
- 距底部 `< 72px` 触发加载更多
- `refreshHistorySessionList()`：打开抽屉时从第一页重拉
- 合并策略：append 时用 `existingIds` 去重，避免重复 session

#### 4.4 选择会话

`views/chat/session-list/index.tsx`：
- 选择会话时：
  - 关闭分享模式、清空勾选
  - `chatStore.setActiveSessionId(session.id)`（并触发会话 loading 遮罩逻辑）
  - `chatStore.setAllMessages(session.messages, session.id, false)`
  - 关闭抽屉并导航到 `/chat/c/{id}`

#### 4.5 会话重命名

- UI：hover 显示编辑按钮，进入编辑态后：
  - Enter/Blur/点击确认都会提交
  - 输入法组合（isComposing）期间不会误触提交
- 提交条件：新标题非空、且与旧标题不同
- 成功后：
  - 调用 `updateSession(sessionId, title)`
  - `chatStore.updateSessionData(sessionId, title)`

#### 4.6 删除会话（含流式安全）

- 删除确认后调用 `deleteSession(sessionId)`
- 若删除的是当前会话：
  - `stopGenerating(sessionId, true)`（以卸载语义停止，不弹“立即停止”提示）
  - `clearChat(sessionId)`
  - 导航到 `/chat`
- 若删除的是其它会话：
  - 仍会 `stopGenerating(sessionId, true)`，避免后台仍在流式占资源
- 最后 `chatStore.updateSessionData(sessionId)` 从列表移除

---

### 5. 发送链路与流式协议（SSE）

#### 5.1 发送入口（统一 sendMessage）

`useChatCore.sendMessage(content?, index?, isEdit?, attachments?)` 会根据入参分流：

- **编辑模式**：`isEdit=true` 且 `editMessage` 存在 → `handleEditMessage()`
- **重新生成**：`content!==undefined && index!==undefined && !isEdit` → `handleRegenerateMessage(index)`
- **普通发送**：否则 → `handleNewMessage(content || input.trim(), uploadedFiles)`

发送后统一动作：
- 触发 `onScrollTo('down','auto')`（优先 props，其次 Context ref）
- 清空输入框与已上传文件列表

#### 5.2 handleNewMessage（新消息）

- 生成 `userMsgId` 与 `assistantMessageId`（uuid）
- 取当前展示链尾 `lastMsg` 作为 parent：
  - 若存在 lastMsg：
    - `parentId=lastMsg.chatId`
    - 清空该分支链路的 `finishReason`（`buildBranchPath + clearFinishReasonByBranchPath`）
    - 清空 parent 的 stopped 状态（只清最后一条，避免跨分支误清）
- 构造两条消息并入树：
  - user：带 `attachments`（若有）
  - assistant：`content=''`、`thinkContent=''`、`isStreaming=true`
- 更新分支选择 `selectedChildMap`：
  - 若无 parent：`'root' -> userMsgId`
  - 否则：`parentId -> userMsgId`
- 保存请求快照 `RequestSnapshot`（用于回滚）
- 调用 `onSseFetch()` 发起 SSE；首轮发送可 `to=true` 导航到会话路由

#### 5.3 handleEditMessage（编辑用户消息）

- 编辑不是“原地改写”，而是**在同一 parent 下新增一对（user, assistant）作为新分支**：
  - 找到被编辑的旧 user 消息，取其 `parentId`
  - 新建 `userMsgId` / `assistantMessageId`
  - 将父节点 `childrenIds` 追加新的 userMsgId
  - `selectedChildMap` 指向这条新 user 分支
  - 发送 SSE（与普通发送一致）
- 编辑完成后 `setEditMessage(null)` 退出编辑态

#### 5.4 handleRegenerateMessage（对某条 assistant 重新生成）

- 在“该 assistant 的父 user”下新增一个 assistant 兄弟：
  - 复制父 user（保留 content），将其 `childrenIds` 追加新的 `assistantMessageId`
  - `selectedChildMap.set(userChatId, assistantMessageId)` 切换到新 assistant 分支
- 发起 SSE，传 `isRegenerate=true`
  - 请求体里 user content 变为提示语：`重新生成"..."`
  - 并设置 `noSave: true`（避免把提示语落库）

#### 5.5 onSseFetch（流式发送与回调）

使用 `streamFetch()`（`apps/frontend/src/utils/sse.ts`）消费后端 `data: JSON` 行协议。

关键行为：
- 确保 sessionId：没有则 `createSession`；失败则 `clearChat()` 并返回
- 首次发送可 `navigate('/chat/c/{sessionId}')`
- 会话 loading：`chatStore.setSessionLoading(sessionId,true)`
- 保存 streamingBranchMap：`assistantMessageId -> { sessionId, branchMap }`
- 构造请求体 `ChatRequestParams`：
  - `messages: [{role, content, noSave?}, systemMessage?]`
  - `sessionId, stream=true, isRegenerate, parentId, userMessage, assistantMessage, currentChatId, role`
  - `attachments`（若 user 有附件）
  - `webSearch=true`（若开启联网搜索）

回调约定（重要）：
- **onThinking(thinkingChunk)**：追加到 `thinkContent`
  - 标记 `hasReceivedStreamData=true`
  - 使用 `chatStore.appendStreamingContent(chatId, chunk, 'thinkContent')`（requestAnimationFrame 节流批量更新）
- **onData(contentChunk)**：追加到 `content`
  - 同样走 `appendStreamingContent(...,'content')`
- **onGetFinishInfo(FinishInfo)**：保存到 `chatStore.finishReasonMap`，并写回 message.finishReason
  - 当 `reason==='length'` 时会在 UI 展示“点击接着回答”
- **onGetSearchOrganic(SearchOrganic)**：将联网检索结果写入 `message.searchOrganic`
- **onComplete(error?)**：
  - `setSessionLoading=false`
  - `flushMessageUpdate(assistantMessageId)` 确保缓冲落盘
  - `updateMessage(assistantMessageId,{isStreaming:false, ...(error?{content:error}: {})})`
  - 清理 streamingBranchMap、stopRequest、snapshot、hasReceived、currentAssistant 映射
- **onError(err)**：
  - `setSessionLoading=false`
  - 若 err 非 “Request cancelled” 则 Toast
  - 若存在 snapshot 且 `hasReceivedData===false`：
    - 移除正在流式的 assistant 消息
    - `restoreState(snapshot.messages, snapshot.selectedChildMap, snapshot.sessionId)`
  - 清理 currentAssistant 映射

#### 5.6 streamFetch 协议解析（/chat/sse 等）

`streamFetch` 行协议规则：
- 仅解析以 `data:` 开头的行，后续 JSON.parse
- `parsed.error`：触发 `onComplete(error)` 并终止
- `parsed.type==='thinking'`：触发 `onThinking(parsed.content)`
- 其它：触发 `onData(parsed.content)`
- 若 `parsed.content.reason==='length'`：触发 `onGetFinishInfo(parsed.content)`
- 若 `parsed.content.type==='searchOrganic'` 且 `organic` 为数组：触发 `onGetSearchOrganic(parsed.content)`
- 401：清 token、触发 `notifyUnauthorized()`，错误信息为 `请先登录后再试`

---

### 6. 停止生成、继续生成、继续回答

#### 6.1 stopGenerating（停止生成）

入口：`useChatCore.stopGenerating(targetSessionId?, isUnmount=false)`

策略分两类：

- **未收到任何流式数据就停止**（snapshot 存在且 `hasReceivedData=false`）：
  - 移除流式 assistant 消息
  - 回滚到发送前快照（messages + selectedChildMap）
  - 非卸载时提示：`立即停止了生成，消息内容未添加！`

- **已生成部分内容再停止**：
  - 找到当前会话的 `assistantMessageId`
  - `flushMessageUpdate(assistantMessageId)`
  - 标记该消息 `isStreaming=false`
  - 在 `chatStore.stoppedMessages` 写入停止态（权威）

无 stopFn 时也会兜底：若最后一条 assistant 仍在流式则停止它并写 stopped 状态。

此外会清理：
- `chatStore.clearSessionStreamingBranchMaps(sessionId)`
- `requestSnapshot/hasReceived/currentAssistant` 等引用

#### 6.2 onContinue（继续生成：针对被 stop 的 assistant）

- 仅当展示链尾是 assistant 且在 `stoppedMessages` 中：
  - 清空 stopped 状态
  - 将该 assistant 标记回 `isStreaming=true`
  - 构造 userMsgForApi：内容为“继续上次断点后输出”的指令
  - 调 `onSseFetch('/chat/continueSse', lastAssistantChatId, userMsgForApi, assistantMsgForApi)`

#### 6.3 onContinueAnswering（接着回答：因长度限制）

- 当 `finishReason.maxTokensReached=true` 时，UI 会展示“点击接着回答”
- 点击后调用 `onContinueAnswering()`：
  - 实际发送一条用户消息 `继续回答`
  - 同时注入 systemMessage：`继续上次未完成的内容...`
  - 走普通 `handleNewMessage` 链路（即新增一轮对话）

---

### 7. 分支切换（兄弟 prev/next、回到流式分支、回到最新分支）

#### 7.1 单条消息兄弟切换（左右箭头）

渲染与交互：
- `buildMessageList` 会为展示链上的每条 message 计算 `siblingIndex/siblingCount`
- `ChatMessageActions` 在 `siblingCount>1` 时显示左右箭头 + “x / n”
- 点击箭头触发 `ChatBotView.handleBranchChange(msgId, direction)`

实现细节（关键）：
- 兄弟集合必须基于 **flatMessages（全量树）** 查找，不能基于 displayMessages（否则丢分支）
- 更新 `selectedChildMap`：
  - 若该消息有 parent：`newSelectedChildMap.set(parentId, nextMsg.chatId)`
  - 否则：`newSelectedChildMap.set('root', nextMsg.chatId)`
- 滚动稳定性（企业级体验）：
  - 助手消息切分支时，会将“分支控件锚点”在视口中的位置钉住，避免切换后内容高度变化导致操作区跳出视野
  - 对长消息（行高超过视口阈值）退化为“行底贴视口底”
  - 使用 `flushSync` 保证分支 map 与渲染在同一帧提交，减少闪烁
  - 同时用 rAF 双帧补对齐，避免 MdPreview 懒挂载导致首帧测量不准

#### 7.2 回到正在生成的分支 / 回到最新分支

底部 `ChatControls`：
- **回到正在生成的分支**：当“当前会话仍在流式”但“流式消息不在当前展示链”时出现
  - 数据来自 `streamingBranchSource.getStreamingMessages()` + `streamingBranchMaps`
  - 切换后会短延迟滚到底
- **回到最新分支**：当当前 `selectedChildMap` 不是“每层都选时间最新 child”时出现
  - `findLatestBranchSelection(allFlatMessages)` 推导 latest map
  - 应用并持久化后滚到底

---

### 8. 滚动、锚点导航、自动贴底

#### 8.1 自动贴底与滚动控制

`ChatBotView` 维护：
- `autoScroll`：是否处于贴底模式（由 DOM 计算得出，不依赖旧 state）
- `isAtBottom`：底部按钮方向判断
- `hasScrollbar`：是否出现滚动条（用于显示滚动 FAB）

贴底策略：
- 流式阶段通过 ResizeObserver + MutationObserver 监听内容高度变化：
  - 在 `autoScroll=true` 且尾条为 streaming assistant 时，持续滚到底
- 从历史记录进入会话时，会补一次“滚到底”（仅一次），避免 `autoScroll=false` 时无法自动触发
- 流式刚结束且开启联网搜索时，会补一次贴底（因为流式结束后会追加“已阅读 n 个网页”等区块导致高度突增）

#### 8.2 锚点导航（只基于 user 消息）

`ChatAnchorNav`：
- 当 user 消息数 < 2 时不显示
- 计算 activeAnchor：取容器高度 1/3 的“中线”，找到最接近且在中线之上的 user 消息
- 滚动节流：requestAnimationFrame
- 程序化 smooth 滚动期间锁住计算，避免高亮跳动；`scrollend` + 1s 超时兜底解锁
- 侧栏锚点列表会自动滚动使 active 点居中（`behavior: auto`，避免双 smooth 动画叠加）

---

### 9. 输入区、快捷键、附件上传、联网搜索

#### 9.1 文本域与 Enter 行为（useEntry）

`ChatTextArea` 使用 `useEntry` 统一处理键盘：

- **Enter（无修饰键）**：发送
- **Enter + (Ctrl/Meta/Shift)**：插入换行
- **输入法组合（isComposing）期间**：
  - 若按下 Ctrl/Meta+Enter：插入换行
  - 其它 Enter 不触发发送，避免中文输入中断

编辑模式（message 编辑）：
- UI 提供“取消/发送”按钮
- Enter 无修饰键也会触发“发送编辑结果”

#### 9.2 附件上传（ChatEntry + Upload）

限制（UI 与 Upload 验证一致）：
- **最多 5 个文件**
- **单文件最大 20MB**（ChatEntry 传入）
- **支持格式**：PDF、DOCX、XLSX、PNG、JPG、JPEG、WEBP（由 `CHAT_VALIDTYPES` 与 Upload.validTypes 限制）

上传流程（chat 页面容器）：
- `uploadFiles(files[])` 成功后把返回的 `UploadedFile` 追加到 `uploadedFiles`
  - 将 `path` 转为可访问 url：`VITE_DEV_DOMAIN + item.path`
  - 为每个 uploadedFile 补 `uuid`

发送时附件归属：
- 附件挂在 user 消息 `attachments`
- SSE 请求体的 `attachments` 字段仅在 userMessage.attachments 存在时传入

#### 9.3 联网搜索开关（webSearch）

- 输入区提供“联网搜索”按钮（aria-pressed）
- 状态由 `ChatCoreProvider.webSearchEnabled` 统一管理
- 发送时若开启：请求体带 `webSearch: true`
- SSE 若返回 `searchOrganic`，会渲染：
  - “已阅读 n 个网页”入口
  - 引用角标预览、列表弹窗等（由 `ChatAssistantMessage` 负责）

---

### 10. 分享模式与创建分享链接

#### 10.1 进入分享模式

入口：
- chat 顶部 `Waypoints` 图标（仅在会话存在、非 loading、且不在分享模式时显示）
- 或消息操作条的分享按钮（`ChatMessageActions` 内置）

进入后行为：
- `isSharing=true`
- 默认全选当前展示链的所有消息（`setAllCheckedMessages(getDisplayMessages())`）

#### 10.2 勾选逻辑（成对选择）

`ChatCoreProvider.setCheckedMessage(message)`：
- 点 assistant：与其 parent user 成对切换
- 点 user：与其“最后一个 child”（通常是当前 assistant）成对切换

分享条：
- “全选”基于当前 displayMessages 判断；可一键全选/清空
- 显示“已选择 {checkedMessages.size/2} 组对话”

#### 10.3 创建分享链接

`views/chat/share/index.tsx`：
- 调 `createShare({ chatSessionId, messageIds?, baseUrl })`
  - baseUrl：DEV 用 `VITE_DEV_WEB_DOMAIN`，PROD 用 `VITE_PROD_WEB_DOMAIN`
- 成功后：
  - 从存储读取主题（优先 store，避免 useTheme 异步滞后）
  - 将主题附加到 shareUrl（`appendShareThemeQuery`）
  - 自动复制链接（优先 Clipboard API，失败 fallback `copyToClipboard`）
- 复制提示：`copied` 状态维持 5s

关闭弹窗时：
- 清空 `shareInfo`
- 并在 chat 容器 `onCloseShareModel` 中退出分享状态、清空勾选

---

### 11. 性能与一致性约束（必须遵守）

- **流式渲染节流**：`chatStore.appendStreamingContent` 采用 requestAnimationFrame 批量更新，减少每 token 触发渲染。
- **会话切换不打断其它会话流式**：
  - `chatStore.setAllMessages` 会保留跨会话的 streamingMessages，并在合并时避免覆盖非 streaming 内容。
  - `clearChat` 仅清理“非流式会话”的引用与 streamingBranchMaps，防止后台流式被误清。
- **停止态权威来源**：停止状态由 `chatStore.stoppedMessages` Map 管理，`setAllMessages` 合并后会根据 Map 回填 `isStopped`，避免被历史 hydrate 覆盖。
- **稳定引用**：
  - `useMessageTools` 返回单例对象，避免函数引用抖动导致依赖链重跑
  - `SessionList` 的 loadingSessions 依赖用排序拼接字符串，避免 [...set] 每次新引用
- **分支切换滚动钉住**：助手消息切分支时必须维持操作区可见（锚点钉住 + 长消息退化策略 + 双帧修正）
- **未收到流式即停止/错误必须回滚**：避免出现“只多出一个空 assistant 气泡”的脏状态

---

### 12. 验收清单（可直接用于测试）

- **会话**
  - 进入 `/chat` 会清空旧会话，发送首条后自动跳转 `/chat/c/:id`
  - 刷新 `/chat/c/:id` 后能自动拉回历史并渲染
  - 历史会话抽屉支持分页滚动加载、空态与加载态提示
  - 重命名支持 Enter/Blur/按钮提交，输入法组合不误触
  - 删除会话会停止该会话流式；删除当前会话会回到 `/chat`
- **发送与流式**
  - 普通发送能立即出现 user+assistant 两条，assistant 流式更新 content/thinkContent
  - 401 会触发未授权处理并提示
  - 若请求失败且未收到任何流式数据，UI 必须回滚到发送前（不残留空 assistant）
  - stop：未收到流式就 stop → 回滚并提示；收到流式后 stop → 保留已生成内容并显示“继续生成”
  - continue：对 stopped 的尾条 assistant 可继续生成
  - length：触发“点击接着回答”，点击后新增一轮继续输出
- **分支**
  - 编辑 user 消息会生成新分支（非原地覆盖），并切换到新分支输出
  - 对任一 assistant 可重新生成，产生兄弟分支并切换
  - 分支左右切换时视口稳定，不出现操作区跳出视野/闪烁
  - 当正在流式但不在当前分支链时出现“回到正在生成的分支”
  - 当不在最新分支时出现“回到最新分支”
- **附件与联网**
  - 上传限制：5 个/20MB/格式校验；上传成功后附件显示并随 user 消息发送
  - 开启联网搜索会在请求体携带 `webSearch=true`，并能渲染“已阅读 n 个网页”与引用预览
  - 流式结束后（联网开关开启）若内容高度增加，仍保持贴底
- **分享**
  - 进入分享模式默认全选当前展示链，显示组数正确
  - 点 user/assistant 都按“对话组”成对勾选
  - 创建分享链接成功会自动复制，并带正确主题参数
  - 关闭弹窗会退出分享模式并清空勾选

