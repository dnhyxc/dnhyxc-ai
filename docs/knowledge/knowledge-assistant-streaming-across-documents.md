# 知识库助手：切换文档时保持流式输出（影响点说明）

本文记录一次围绕「知识库右侧助手」的状态机改造：当助手正在 **streaming（流式输出）** 时切换到其它文档，再切回原文档，原先会出现「只展示 *思考中...*、流式状态变停止、无法继续看到打字机效果」的问题。本次改动目标是在 **不改变现有产品语义** 的前提下修复该问题，并说明改动的影响范围与潜在风险。

---

## 1. 改动背景与根因

### 1.1 现象

- 文档 A 的助手正在流式输出时切换到文档 B。
- 再切回文档 A：UI 只显示「思考中...」，并且流式状态被置为停止，打字机增量不再继续。

### 1.2 根因（前端状态机层面）

根因主要来自两点（均发生在 `assistantStore` 的“文档切换”与“流式回调写入”路径）：

- **切换文档时中断流式**：`activateForDocument` 在切换时会 `abortStream` 并重置消息数组，导致正在进行的 SSE 被打断。
- **流式回调写错目标**：流式回调（`onDelta/onThinking/onComplete/onError`）若依赖“当前 active 文档”的 getter（例如 `this.messages`），在用户切换文档后会把增量写入到 *切换后的文档* 状态，导致原文档的 UI 看起来“停止/丢失”。

此外，知识页的 `documentKey` 设计包含 `__trash-{trashOpenNonce}` 等后缀，用于 UI 分栏/视图身份；该 key 在切换过程中可能变化。若助手状态按 `documentKey` 原样分桶，会产生**同一条目被拆成多个 state** 的情况，切回时命中“新 key”的空 state，从而退化为「思考中...」。

---

## 2. 本次改动做了什么

改动文件：`apps/frontend/src/store/assistant.ts`。

### 2.0 关键实现代码（带详细注释，便于对照源码）

以下代码块为“摘录 + 注释增强版”，逻辑与当前仓库实现保持一致（以源码为准）。注释尽量解释**为什么要这么做**，而不是复述代码字面含义。

#### 2.0.1 `canonicalKey` 与 `ensureState`：用稳定 key 分桶并确保每个文档有独立 state

```ts
/**
 * 目标：
 * - 解决 `documentKey` 可能携带 `__trash-*` nonce 导致的 state 分裂问题。
 * - 让“同一知识条目”的助手状态（messages/session/streaming 等）绑定到稳定标识，而不是 UI 视图身份。
 *
 * 关键点：
 * - `documentKey` 是 UI 维度身份（可能随 UI nonce 变化）
 * - `bindingId`（去掉 `__trash-*` 后缀）才是“同一条目”的稳定语义
 */
private canonicalKey(documentKey: string): string {
  const raw = (documentKey ?? '').trim();
  if (!raw) return '';

  // 优先用 bindingId（去掉 __trash-* 后缀），让同一条目的 key 稳定
  // 如果解析失败则回退 raw，避免 key 为空造成整个状态机失效
  return knowledgeArticleBindingFromDocumentKey(raw) || raw;
}

/**
 * 目标：
 * - 将 assistant 的运行态从“全局单例字段”改为“按文档分桶”的结构。
 *
 * 为什么必须“按文档分桶”：
 * - 只要允许切换文档不打断流式，就必须允许不同文档同时存在进行中的 SSE；
 *   因此 `abortStream/messages/isSending` 必须与文档绑定，否则会互相覆盖/误停。
 */
private ensureState(documentKey: string) {
  const key = this.canonicalKey(documentKey);

  // 注意：这里返回一个“临时对象”只是为了避免 getter 报错；
  // 业务上发送消息前仍会提示「文档未就绪」，不会真的用空 key 发请求。
  if (!key) {
    return {
      sessionId: null,
      messages: [],
      isHistoryLoading: false,
      isSending: false,
      loadError: null,
      abortStream: null,
      historyHydrated: false,
    };
  }

  // 每个 key 对应一份 state：切换文档只切“指针”，不会清空其它文档的 state
  if (!this.stateByDocument[key]) {
    this.stateByDocument[key] = {
      sessionId: null,
      messages: [],
      isHistoryLoading: false,
      isSending: false,
      loadError: null,
      abortStream: null,
      historyHydrated: false,
    };
  }
  return this.stateByDocument[key];
}
```

#### 2.0.2 `sendMessage`：流式回调绑定“发送时的文档 state”，避免切换后写错目标

```ts
async sendMessage(raw?: string, options?: { extraUserContentForModel?: string }) {
  // 取“当前 UI 指针”对应的 documentKey（可能带 __trash-*）
  const documentKey = (this.activeDocumentKey ?? '').trim();
  if (!documentKey) {
    Toast({ type: 'warning', title: '文档未就绪' });
    return;
  }

  // 使用稳定 key 分桶：避免切换过程中 key 变体导致 state 分裂
  const canonical = this.canonicalKey(documentKey);
  const state = this.ensureState(canonical);

  const text = (raw ?? '').trim();
  // 重要：判断发送/加载必须使用“该文档自己的 state”，而不是全局字段
  if (!text || state.isSending || state.isHistoryLoading) return;

  const ephemeral = !this.knowledgeAssistantPersistenceAllowed;

  // 省略：持久化下 ensureSession / ephemeral 下 token 校验等逻辑...

  // 关键：ephemeral 的多轮上下文，从“该文档自己的消息列表”构建
  // 这样即使切换文档，contextTurns 仍与当时发送的文档一致
  const contextTurns = ephemeral
    ? buildEphemeralContextTurnsFromMessages(state.messages)
    : undefined;

  // 关键：abort 也只 abort 当前文档的流
  state.abortStream?.();
  runInAction(() => {
    state.abortStream = null;
  });

  // push 本轮 user + assistant 占位，写入的是该文档的 state.messages
  // 注意：这确保 UI 在切换回来时能看到“同一份 messages”持续增长
  runInAction(() => {
    state.isSending = true;
    state.messages.push({ role: 'user', content: text, chatId: uuidv4(), timestamp: new Date() });
    state.messages.push({ role: 'assistant', content: '', chatId: uuidv4(), timestamp: new Date(), isStreaming: true, thinkContent: '' });
  });

  // 关键：apply patch 只更新该文档 state.messages
  // 这是修复“切走后 delta 写进别的文档”的核心点
  const applyAssistantPatch = (delta: string, thinkDelta?: string) => {
    // 省略：accumulated/thinkBuf 拼接...
    runInAction(() => {
      // 在 state.messages 里找到占位 assistantChatId 并替换为新对象（触发 MobX 更新）
      // 这里的“替换”比原地 mutate 更稳定（避免子 observer 订阅丢失）
    });
  };

  const abort = await streamAssistantSse({
    body: ephemeral
      ? { ephemeral: true, content: text, contextTurns }
      : { sessionId: '...', content: text },
    callbacks: {
      // 所有回调都只 touch 该 state，而不是 this.messages（避免 activeDocumentKey 改变后串写）
      onDelta: (d) => applyAssistantPatch(d),
      onThinking: (t) => applyAssistantPatch('', t),
      onComplete: async () => {
        runInAction(() => {
          state.isSending = false;
          // 省略：把该文档的 assistant 占位 isStreaming 置为 false...
        });
        state.abortStream = null;

        // 持久化路径下：回填也必须按 canonical key 定位该文档（避免切换后回填到错误文档）
        // await this.fetchSessionMessagesForDocumentKey(canonical);
      },
      onError: () => {
        runInAction(() => {
          state.isSending = false;
          // 省略：收尾该文档 assistant 占位...
        });
        state.abortStream = null;
      },
    },
  });

  state.abortStream = abort;
}
```

#### 2.0.3 `activateForDocument`：切换文档只切“指针”，不再全局 abort / 清空

```ts
async activateForDocument(documentKey: string) {
  const nextKey = (documentKey ?? '').trim();
  if (!nextKey) return;

  // docKey = 稳定 key：同一条目共享同一份 state
  const docKey = this.canonicalKey(nextKey);

  // 关键：只更新 activeDocumentKey（UI 指针），并确保该文档 state 存在
  // 不再在这里 abortStream / messages = []，否则会把“别的文档”的流式打断
  runInAction(() => {
    this.activeDocumentKey = nextKey;
    this.ensureState(docKey);
  });

  // 后续：持久化允许时按需 hydrate 历史（略）
}
```

#### 2.0.4 `clearAssistantStateOnKnowledgeDraftReset`：清理也必须用 canonicalKey，否则会删错桶

```ts
/**
 * 注意：
 * - 这个函数常用于“清空草稿 / 新建草稿”场景。
 * - 在引入 canonicalKey 分桶之后，如果 delete 还用 raw documentKey，会出现：
 *   state 实际存在于 canonicalKey 下，但 delete 用了 rawKey → 视觉上“没清掉对话”。
 */
clearAssistantStateOnKnowledgeDraftReset(syncActiveDocumentKey?: string | null) {
  const rawKey = this.activeDocumentKey;
  const key = rawKey ? this.canonicalKey(rawKey) : '';
  const state = key ? this.ensureState(key) : null;

  // 先停止该文档的 SSE（避免清理后仍有 delta 写入）
  state?.abortStream?.();
  if (state) state.abortStream = null;

  runInAction(() => {
    // 关键：按 canonicalKey 删除，确保删到正确的 state 桶
    if (key) {
      delete this.stateByDocument[key];
      delete this.sessionByDocument[key];
    }

    // 同步 UI 指针（外部把 nextKey 传进来时）
    const next = syncActiveDocumentKey?.trim();
    if (next) {
      this.activeDocumentKey = next;
      // 确保 nextKey 对应 state 存在，避免后续 getter 指向空引用
      this.ensureState(next);
    }
  });
}
```

### 2.1 按文档隔离运行态（stateByDocument）

将以下运行态从“单例字段”改为“按文档 key 分桶”的结构（每个文档独立一份）：

- `sessionId`
- `messages`
- `isHistoryLoading`
- `isSending`
- `loadError`
- `abortStream`
- `historyHydrated`（新增：避免重复 hydrate）

这样切换文档时不会影响其它文档的流式输出，也不会清空其它文档的消息。

### 2.2 引入 canonicalKey（稳定 key）避免 state 分裂

知识页的 `documentKey` 可能携带 `__trash-*` 后缀（nonce）。本次在 store 内新增了稳定 key 规则：

- `canonicalKey(documentKey)`：优先使用 `knowledgeArticleBindingFromDocumentKey(documentKey)`（去掉 `__trash-*`）作为 state/session 的分桶 key。

效果：同一篇知识条目在 UI 层 `documentKey` 变化时，依然命中同一份助手 state，流式输出不会因为 key 变体被“切断到另一份空状态”。

### 2.3 流式回调绑定“发送时的文档”而不是“当前 active 文档”

在 `sendMessage` 中发送瞬间捕获：

- `documentKey`（以及其 `canonicalKey`）
- 对应的 `state`

并且在 SSE 回调里只更新该 `state.messages`。同时在持久化路径的结束回填中，使用 `fetchSessionMessagesForDocumentKey(canonicalKey)`，避免切换文档后把 DB 回填写到错误的文档上。

### 2.4 activateForDocument 不再全局中止流式

`activateForDocument` 只更新 `activeDocumentKey`（UI 指针）并确保对应 state 存在；不再对其它文档的 `abortStream/messages` 做全局操作。

---

## 3. 影响点清单（对现有功能的影响评估）

### 3.1 不应改变的功能（保持不变）

- **未保存云端草稿（ephemeral）**：
  - 仍然不落库，仍使用 `contextTurns` 拼上下文。
  - 保存后迁入（`import-transcript`）逻辑不变：仍以当前内存 `messages` 生成 `lines`。
- **已保存条目 / 本地文件 / 回收站预览（持久化允许）**：
  - 会话创建、按条目拉历史、停止生成、完成后回填的产品语义不变。
- **UI 层（`KnowledgeAssistant.tsx`）**：
  - 仍以 `assistantStore.messages` 渲染列表，仍用 `assistantStore.isStreaming/isSending/isHistoryLoading` 控制按钮状态。

### 3.2 行为变化（应当接受的变化）

- **切换文档不再中断正在生成的回复**：如果用户在文档 A 流式生成时切到文档 B，文档 A 的流式会在后台继续，切回后能看到最终结果与增量过程。
- **同一条目不同 `__trash-*` 变体会共享同一份 state**：这是为了保证“切回继续流式”，也与 `bindingId` 的语义一致（同一条目/同一草稿逻辑身份）。

### 3.3 潜在风险与注意事项

- **内存占用增加**：现在每个访问过的条目会保留一份 `messages/state`（直到被显式清理或刷新页面）。若用户在一个会话内快速浏览大量条目，内存占用会增加。
  - 缓解建议：后续如有需要，可加 LRU（最近最少使用）清理策略，或限制缓存条目数。
- **“清空草稿”清理范围**：`clearAssistantStateOnKnowledgeDraftReset` 仍是关键清理入口。
  - 本次改动后 store 内部的清理也统一使用 `canonicalKey`，避免出现「state 存在于 canonicalKey 下，但 delete 用了原始 `documentKey`」导致清空不生效的问题。
  - 注意：用户手动把左侧正文删空与“重置到新草稿”（`resetEditorToNewDraft`）是两条不同路径；前者未必会触发 `clearAssistantStateOnKnowledgeDraftReset`，因此若产品期望“正文删空也要清对话”，需要在知识页额外做联动（不要在本次改动里隐式改变该语义）。
- **跨条目并发流式**：本次改动允许不同文档并发流式（每份 state 有独立 `abortStream`）。如果后端对同一用户的并发有额外限制，需观察是否会触发后端限流/占用提示。

---

## 4. 回归建议（知识库相关）

- **流式切换**：文档 A 流式时切到文档 B，再切回 A，应继续看到打字机增量，且最终完成态正确。
- **保存迁入**：未保存草稿（ephemeral）产生对话 → 保存为云端条目 → 再打开该条目，应能拉到迁入后的历史。
- **回收站预览隔离**：回收站预览条目与正式条目之间会话不串；同一预览条目多次打开仍能命中同一会话（按 bindingId）。
- **停止生成**：在当前文档点击停止仍能立即停止该文档的流式；切换文档不应误停其它文档的流式。

