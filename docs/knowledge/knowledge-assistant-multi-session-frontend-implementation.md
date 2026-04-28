# 知识库助手（AI 模式）——按文章多 Session 会话（前端实现思路与代码注释）

> 本文从 `apps/frontend` 的**现有实现**反推实现思路，面向“每篇文章支持多个 session 对话 + 历史记录抽屉 + 并发流式互不影响”。
>
> 约束：
> - **不改变既有功能语义**：不传新字段时保持单会话/原接口行为不变（后端兼容由后端实现；本文只聚焦前端）。
> - **允许并发流式**：A 会话流式时切到 B 会话继续提问，不会 stop/abort A；切回 A 仍能看到打字机（streaming）增量。
>
> 相关入口：
> - UI：`apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx`
> - Store：`apps/frontend/src/store/assistant.ts`
> - API：`apps/frontend/src/service/api.ts`、`apps/frontend/src/service/index.ts`

---

### 1. 目标与范围

- **目标**
  - **同一篇知识文章（knowledgeArticleId/documentKey）下支持多会话（Session）**：每次“新对话”创建一个新的 `sessionId`，并能在历史记录中切换。
  - **历史记录抽屉（Drawer）**：通过一个圆形按钮打开抽屉展示历史会话列表；点击条目切换会话。
  - **流式输出（SSE）切换一致性**：会话切换不影响正在流式输出的会话；切回后继续展示增量内容（打字机效果）。

- **范围**
  - 仅覆盖 **知识库右侧助手 AI 模式**（`assistantStore`）的多会话能力。
  - RAG 问答（`knowledgeRagQaStore`）保持原逻辑（本次不展开）。

- **非目标**
  - 不在本文中定义后端数据迁移/数据库结构（只描述前端如何调用接口）。
  - 不引入新的 UI 组件库（复用仓库现有 `@design/Drawer`）。

---

### 2. 目录结构与关键入口

- **入口文件**
  - `apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx`

- **关键依赖**
  - **Store（MobX）**：`apps/frontend/src/store/assistant.ts`
  - **service/api**：
    - `apps/frontend/src/service/api.ts`
    - `apps/frontend/src/service/index.ts`
  - **SSE 工具**：`apps/frontend/src/utils/assistantSse.ts`（沿用既有协议）
  - **UI 抽屉**：`apps/frontend/src/components/design/Drawer/index.tsx`

---

### 3. 核心概念与术语

- **Session（会话）**
  - 后端 `assistant_sessions.id`，前端用 `sessionId` 表示一次多轮对话容器。

- **documentKey（文档 key）**
  - 知识库编辑区与助手联动的稳定标识；助手内部会做 canonical 化（规范化），避免 `__trash-*` 等后缀导致状态串联。

- **canonicalKey（规范化 key）**
  - `assistantStore.canonicalKey(documentKey)`：把 UI nonce 后缀去掉，保证“同一文章”落到同一个 state 桶。

- **SSE（Server-Sent Events，服务端推送事件）**
  - AI 回复采用流式增量回调：`onDelta` 持续追加 `content`，UI 呈现为“打字机效果”。

- **ephemeral（临时态/不落库）**
  - 当 `knowledgeAssistantPersistenceAllowed=false`（比如未保存草稿）时，不创建后端会话，仅在前端内存里维持上下文；该模式不支持多 session（保持旧行为）。

---

### 4. 用户可见功能点（按用户动作拆分）

#### 4.1 进入某篇文章时：自动恢复「当前会话」消息（不预拉会话列表）

- **触发入口**
  - `KnowledgeAssistant` 的 `useEffect`：`assistantStore.activateForDocument(documentKey)`

- **前置条件/互斥条件**
  - 若 `knowledgeAssistantPersistenceAllowed=false`：不走服务端会话恢复（保持旧逻辑）。
  - 未登录（token 空）：不请求服务端。

- **状态变化（state/ref/map）**
  - `activeDocumentKey` 指向当前文章（未打断其它文档/会话流式）。
  - 若可持久化：根据 **`activeSessionByDocument` / `sessionByDocument` 已有指针** 或 **`GET .../session/for-knowledge`** 恢复「最近会话 + 消息」；必要时再 **`GET .../session/:sessionId`** 拉详情。**不在此阶段调用** `GET .../sessions/for-knowledge`（会话列表留给抽屉打开或首轮发消息后的刷新）。

- **网络调用（与实现一致）**
  - 无现成 `sid` 时：`GET /assistant/session/for-knowledge?knowledgeArticleId=...`（最近会话 + 消息，用于首次 hydrate）。
  - 已有 `sid` 且本地尚无消息：`GET /assistant/session/:sessionId`（详情 + 全量 messages）。

#### 4.2 点击「新对话」：创建一个新的 session 并切换

- **触发入口**
  - `KnowledgeAssistant` 输入区 `ChatEntry.entryChildren` 内「新对话」按钮 → `assistantStore.createNewSessionForCurrentDocument()`（与圆形「历史」按钮同一行，**顺序为：历史 → 新对话**）。

- **前置条件/互斥条件**
  - 仅在 `knowledgeAssistantPersistenceAllowed=true` 时启用（草稿 ephemeral 不支持多会话）。
  - 需要登录 token。

- **网络调用**
  - `POST /assistant/session`，携带 `{ knowledgeArticleId, forceNew: true }`（无 `knowledgeArticleId` 时仅 `{ forceNew: true }`）。

- **UI 表现**
  - 立刻切换到新会话（消息列表为空）。
  - **不在该方法末尾 `await` 拉会话列表**；抽屉内列表依赖 **`refreshSessionListForCurrentDocument`**（见 §4.3）、**`ensureSessionForCurrentDocument` 内异步刷新**、以及 **`sendMessage` 成功发起 SSE 后的异步刷新** 更新，故新建后若未打开抽屉，列表可能稍晚才含新会话。

#### 4.3 点击“历史记录”圆形按钮：打开抽屉并切换会话

- **触发入口**
  - 圆形按钮（时钟 icon）→ `setIsAiHistoryDrawerOpen(true)`

- **状态变化**
  - `isAiHistoryDrawerOpen` 控制抽屉开合。
  - **`useEffect([isAiHistoryDrawerOpen])`**：仅在抽屉 **`open === true`** 时调用一次 `assistantStore.refreshSessionListForCurrentDocument()`（无单独「刷新」按钮；列表主要由此 + 首轮会话创建/发消息后的刷新维护）。

- **切换逻辑**
  - 点击某个历史项 → `assistantStore.switchSessionForCurrentDocument(sessionId)`
  - 切换后 UI 自动贴底（`enableStickToBottom + flushScrollToBottom`），保证切回流式会话能看到最新增量。

#### 4.4 并发流式：A 会话流式时切到 B 会话继续提问

- **关键原则**
  - **切换会话不调用 stop/abort**。
  - **每个 sessionId 维护独立的 state**（messages、isSending、abortStream 等），避免互相覆盖。

- **实现点**
  - `assistantStore.stateBySession[sessionId]`：每个会话独立保存消息与流式 abort。
  - `sendMessage()` 在拿到真实 `sid` 后，必须在 `stateBySession[sid]` 上写入增量，避免串写。

---

### 5. 状态模型与数据结构

#### 5.1 Store：文档维度与会话维度双层状态

核心结论：**文档（documentKey）用于定位“当前文章”；会话（sessionId）用于隔离流式与消息**。

下面代码块是 `assistantStore` 中“文档态 + 会话态”的关键结构（为了便于阅读，代码做了逐行中文注释；字段名与真实实现保持一致）。

```ts
// 文档维度：用 canonicalKey(documentKey) 做桶，承载“文档级”信息与 ephemeral（不落库）状态
// - 这里依然保留 messages/isSending 等字段是为了兼容旧逻辑（ephemeral 模式仍使用它们）
// - 持久化多会话时，这些字段的“真值”来自会话维度 stateBySession
private stateByDocument: Record<
  string, // canonical 文档 key
  {
    sessionId: string | null;                 // 兼容字段：旧逻辑用；多会话主要用 activeSessionByDocument
    messages: Message[];                      // ephemeral（不落库）消息列表
    isHistoryLoading: boolean;                // ephemeral/旧逻辑：历史加载
    isSending: boolean;                       // ephemeral/旧逻辑：发送中
    loadError: string | null;                 // 错误文案
    abortStream: (() => void) | null;         // 当前“文档态”流式 abort（ephemeral 用）
    ephemeralStreamId: string | null;         // ephemeral stop 句柄（后端 meta.streamId）
    historyHydrated: boolean;                 // 是否已经 hydrate 过（避免重复请求）
    pendingEphemeralFlush: null | {           // 首次保存仍在流式时，延迟迁入任务
      cloudArticleId: string;
      fromDocumentKey: string;
      toDocumentKey: string;
    };
  }
> = {};

// 会话维度：按 sessionId 分桶，隔离 messages/isSending/abortStream（支持并发流式）
private stateBySession: Record<
  string, // sessionId
  {
    sessionId: string;                        // 会话 id（冗余存储，便于调试）
    messages: Message[];                      // 持久化会话消息列表（含 streaming 增量）
    isHistoryLoading: boolean;                // 会话详情加载中
    isSending: boolean;                       // 会话发送中（仅阻止同会话重入）
    loadError: string | null;                 // 会话错误文案
    abortStream: (() => void) | null;         // 该会话 SSE abort（互不影响）
  }
> = {};

// 文档 → 当前激活会话：切换历史会话仅写这个映射，不影响其它会话 state
activeSessionByDocument: Record<string, string> = {};

// 文档 → 历史会话列表：用于 Drawer 展示（列表按 updatedAt 倒序）
sessionsByDocument: Record<string, Array<{
  sessionId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}>> = {};
```

#### 5.2 activeState 的选择规则（保证切换会话不串流）

`assistantStore` 对外暴露 `messages/isSending/isStreaming/abortStream` 等 getter，它们依赖 `activeState`。

关键点：**持久化模式（允许落库）优先走 session 维度 state**；ephemeral 则保持原文档维度。

```ts
// activeState：决定“当前 UI 看到的是哪一桶状态”
private get activeState() {
  // 如果不允许持久化（ephemeral），仍然使用文档维度 state（保持旧行为）
  if (!this.knowledgeAssistantPersistenceAllowed) {
    return this.ensureState(this.activeDocumentKey);
  }

  // 持久化模式：用 canonical 文档 key 找到当前激活的 sessionId
  const docKey = this.canonicalKey(this.activeDocumentKey);
  const activeSid = (docKey && this.activeSessionByDocument[docKey]) || null;

  // 如果有 activeSid，则 UI getter 直接指向该 session 的 state（实现多会话）
  if (activeSid) {
    return this.ensureSessionState(activeSid);
  }

  // 兜底：兼容旧路径（极端情况下没有 activeSid）
  return this.ensureState(this.activeDocumentKey);
}
```

---

### 6. 协议与接口契约（前端侧）

#### 6.1 新增/扩展的 service 层能力

> 下面是 service 层关键代码（逐行注释），用于说明“如何拿到文章下会话列表 + 强制新建会话”。

```ts
// apps/frontend/src/service/api.ts
export const ASSISTANT_SESSION = '/assistant/session'; // 助手会话：创建/详情
export const ASSISTANT_SESSIONS_FOR_KNOWLEDGE =        // 新增：按知识文章查询会话列表
  '/assistant/sessions/for-knowledge';
```

```ts
// apps/frontend/src/service/index.ts
export const createAssistantSession = async (payload?: {
  title?: string;                     // 可选：会话标题（后端也可能自动生成）
  knowledgeArticleId?: string;         // 可选：绑定文章 id
  forceNew?: boolean;                 // 可选：true 强制新建；false/不传复用最近会话（兼容旧）
}) => {
  // 向后端创建会话；返回 { sessionId, title }
  return await http.post(ASSISTANT_SESSION, payload ?? {});
};

export const getAssistantSessionsByKnowledgeArticle = async (knowledgeArticleId: string) => {
  // 按文章拉取会话列表（后端按 updatedAt 倒序返回；前端仍会再做一次兜底排序）
  return await http.get(ASSISTANT_SESSIONS_FOR_KNOWLEDGE, {
    querys: { knowledgeArticleId },
  });
};
```

#### 6.2 SSE 协议保持不变（关键：并发时不共享 abort）

- 仍使用 `streamAssistantSse()` 创建 `AbortController`，每次调用返回一个独立 abort 函数。
- 现在把 abort 保存到 **会话维度 state**，从而支持多会话并发流式。

---

### 7. 互斥与状态机（关键规则）

#### 7.1 “互斥”的粒度从“文章级”降到“会话级”

- **旧问题**：如果 `sendMessage()` 在拿到真实 `sessionId` 前就选 state，可能错误地把不同会话互斥，或把 A 的流式覆盖到 B。
- **修复策略**：先拿到 `sid`，再使用 `stateBySession[sid]` 判断/写入。

```ts
// assistantStore.sendMessage（关键片段，逐行注释）
async sendMessage(raw?: string) {
  const documentKey = (this.activeDocumentKey ?? '').trim(); // 当前文章 key
  if (!documentKey) return;                                  // 无文档则直接返回

  const canonical = this.canonicalKey(documentKey);          // 规范化文档 key（防 __trash-* 串态）
  const docState = this.ensureState(canonical);              // 文档态（ephemeral 用）
  const ephemeral = !this.knowledgeAssistantPersistenceAllowed; // 是否不落库

  const text = (raw ?? '').trim();                           // 用户输入
  if (!text) return;                                         // 空输入不发

  let sid: string | null = null;                             // 目标会话 id
  if (!ephemeral) {                                          // 持久化模式
    sid = await this.ensureSessionForCurrentDocument();       // 确保拿到真实 sessionId
    if (!sid) return;                                        // 创建失败则返回
  }

  // 关键：必须在拿到 sid 后才选择 state（否则并发会串写/互斥）
  const state = ephemeral ? docState : this.ensureSessionState(sid!);

  // 同会话内互斥：只阻止“同一 sessionId”重入；不同 sessionId 允许并发
  if (state.isSending || state.isHistoryLoading) return;

  // ...后续：写入 user/assistant 占位、启动 SSE、onDelta 增量写入 state.messages ...
}
```

#### 7.2 onComplete 对齐消息：只能刷新“本次请求的 sid”

并发时 UI 可能切到另一个会话；因此 onComplete **不能用 activeSessionId** 去拉详情覆盖当前 state，否则会导致两会话内容相同。

```ts
// onComplete（关键片段，逐行注释）
onComplete: async (err) => {
  // ...先把当前会话的 streaming 置 false ...

  // 成功结束后，为了对齐服务端落库内容，可以拉一次会话详情
  // 关键：必须用“本次请求对应的 sid”，不能用 activeSessionId（并发切换会串写）
  if (!err && !ephemeral) {
    const res = await getAssistantSessionDetail(sid);         // sid 是闭包里本次请求的会话 id
    const payload = res.data;
    if (payload?.session?.sessionId === sid) {                // 再次校验，避免误覆盖
      state.messages = mapApiMessagesToUi(payload.messages ?? []);
    }
  }
}
```

---

### 8. UI：抽屉历史列表（Drawer）与切换一致性

#### 8.1 UI 入口：圆形按钮打开 Drawer

实现原则：**抽屉只负责展示列表与触发切换**，切换逻辑仍然复用 store 方法，从而保持行为一致。

```tsx
// KnowledgeAssistant.tsx — ChatEntry.entryChildren（与当前实现一致；样式为 link + 边框圆按钮等）
const [isAiHistoryDrawerOpen, setIsAiHistoryDrawerOpen] = useState(false);

useEffect(() => {
  if (!isAiHistoryDrawerOpen) return;
  void assistantStore.refreshSessionListForCurrentDocument();
}, [isAiHistoryDrawerOpen]);

// 同一行内：先「历史」圆形按钮，再「新对话」，再 Drawer；其后另起 flex 放 AI/RAG 模式切换
<Button aria-label="历史对话" onClick={() => setIsAiHistoryDrawerOpen(true)}>
  <Clock className="h-4 w-4" />
</Button>
<Button onClick={() => void assistantStore.createNewSessionForCurrentDocument()}>
  <CirclePlus />
  新对话
</Button>
<Drawer title="历史对话" open={isAiHistoryDrawerOpen} onOpenChange={setIsAiHistoryDrawerOpen}>
  {/* 列表项：title 或「对话」+ sessionId 前 8 位；时间用 new Date(s.updatedAt).toLocaleString() */}
</Drawer>
```

> 注意：历史抽屉中**不包含“新对话”按钮/条目**（已按产品要求移除）。

---

### 9. 历史列表顺序与展示时间

- **列表顺序**：`refreshSessionListForCurrentDocument` 将接口返回的 `data.list` 原样写入 `sessionsByDocument`（后端约定按 **`updatedAt` 倒序**）。若需在 UI 侧再兜底排序，可在 `map` 前对副本 `sort`（当前实现以 **接口顺序 + `updatedAt` 字符串可被 `Date` 解析** 为准）。
- **抽屉内时间展示**：`new Date(s.updatedAt).toLocaleString()`；后端宜返回 **ISO 8601（含 `Z`）** 以避免本地/无时区字符串解析漂移（见后端实现与 `knowledge-assistant-multi-session-backend-implementation.md` 中时间字段约定）。

---

### 10. 验收清单（前端）

- **新对话**
  - 点击“新对话”会创建一个新的 session，消息列表为空，且不影响旧会话内容。
  - 新建后在历史抽屉中应排在最前（按时间倒序）。

- **历史抽屉**
  - 点击圆形按钮打开抽屉；抽屉中只有历史会话列表（无“新对话”入口）。
  - 点击任意历史项可切换到该会话；切换行为与原先一致（消息正确、不会 stop 其它会话流）。

- **并发流式**
  - 会话 A 正在流式时，切换到会话 B 并发送消息：A 流式不停止，B 也能正常流式。
  - 切回 A：仍能看到 A 的流式增量持续更新（打字机）。
  - 并发结束后，两会话消息不会互相覆盖（不会出现两边内容相同）。

- **回归点**
  - ephemeral（未保存草稿）仍按旧逻辑：不支持多会话、不会出现历史抽屉入口。
  - 切换文章（`documentKey` 变化）时 **`activateForDocument` 会恢复该文最近会话消息**；**会话全量列表**以打开历史抽屉或发消息后的刷新为准，不在进入文章时强依赖 `sessions/for-knowledge` 预拉。

