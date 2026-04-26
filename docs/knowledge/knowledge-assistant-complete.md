# 知识库右侧 Assistant AI 助手：完整实现说明

本文是知识编辑页 **右侧通用助手**（智谱 GLM、独立于主站 Chat）的 **完整** 实现说明：产品语义、前后端数据流、接口与表结构、MobX 状态机、SSE 协议、未保存草稿（ephemeral）、保存迁入（import-transcript）、清空/删除边界，以及 UI 与可观测性细节。实现代码以仓库当前版本为准；阅读时可对照下列路径跳转。

**相关文档**：持久化与数据落点的专题摘要仍保留在 `knowledge-assistant-ephemeral-persistence.md`（可与本文对照）；**以本文为权威总览**。

**问题修复记录**：

- `knowledge-assistant-streaming-across-documents.md`：修复「流式输出时切换文档再切回」导致只剩“思考中...”与停止的问题（前端状态机按文档隔离 + 稳定 key + 回调绑定）。
- `knowledge-assistant-streaming-across-documents.md`：修复「首次保存时若仍在流式：保存不应终止流式，且不应绑定不完整会话」的问题（延迟迁入 pendingEphemeralFlush，流式结束后再 flush）。

---

## 目录

1. [功能边界与术语](#1-功能边界与术语)
2. [系统架构一览](#2-系统架构一览)
3. [数据库与知识模块联动](#3-数据库与知识模块联动)
4. [后端：路由、DTO、服务逻辑](#4-后端路由dto服务逻辑)
5. [前端：页面编排与 documentKey](#5-前端页面编排与-documentkey)
6. [前端：assistantStore 状态机](#6-前端assistantstore-状态机)
7. [前端：SSE 消费协议 streamAssistantSse](#7-前端sse-消费协议-streamassistantsse)
8. [前端：KnowledgeAssistant UI 层](#8-前端knowledgeassistant-ui-层)
9. [HTTP 封装与类型](#9-http-封装与类型)
10. [关键时序与竞态](#10-关键时序与竞态)
11. [工程细节与约束](#11-工程细节与约束)
12. [文件索引](#12-文件索引)
13. [快捷卡片与 extraUserContentForModel](#13-快捷卡片与-extrausercontentformodel用户短句--模型长上下文)

---

## 1. 功能边界与术语

### 1.1 与主聊天（ChatBot）的隔离

| 维度          | 知识库助手                                                        | 主站 Chat                        |
| ------------- | ----------------------------------------------------------------- | -------------------------------- |
| HTTP 路径前缀 | `/assistant/*`                                                    | `/chat/*` 等                     |
| 流式消费      | `streamAssistantSse`（`apps/frontend/src/utils/assistantSse.ts`） | `streamFetch` 等                 |
| 服务端服务    | `AssistantService`                                                | `ChatService` / `GlmChatService` |
| 会话存储      | `assistant_sessions` / `assistant_messages`                       | 主会话消息表与缓存体系           |

二者 **不共享 sessionId**，避免混用。

### 1.2 术语表

| 术语                                     | 含义                                                                                                                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **documentKey**                          | 传给 `KnowledgeAssistant` 的字符串，格式为 `{assistantArticleBinding}__trash-{trashOpenNonce}`，用于区分「同一逻辑草稿在不同 UI nonce 下」的助手实例。                  |
| **assistantArticleBinding**              | `index.tsx` 中 `useMemo`：`knowledgeTrashPreviewId` 存在时为 `__knowledge_trash__:{行id}`，否则为 `knowledgeEditingKnowledgeId ?? 'draft-new'`。                        |
| **bindingId**                            | `knowledgeArticleBindingFromDocumentKey(documentKey)`：去掉 `__trash-*` 后缀后传给后端的「按文章查会话」标识（可为正式 UUID、`draft-new`、或回收站前缀串）。            |
| **canonicalKey**                         | `assistantStore` 内部对 `documentKey` 规范化后的键：**`__trash-*` 前缀之前** 的条目标识；**`stateByDocument` / `sessionByDocument` 均按 canonicalKey 分桶**，切换 trash nonce 不丢对话。 |
| **knowledgeAssistantPersistenceAllowed** | `assistantStore` 布尔：为 `false` 表示 **未保存云端草稿**，走 ephemeral，不落库。                                                                                       |
| **Ephemeral**                            | SSE body `ephemeral: true` + `contextTurns` + `content`；可选 `extraUserContentForModel`（仅拼进发给模型的 user 句，不落库）；不传 `sessionId` / `knowledgeArticleId`。 |
| **extraUserContentForModel**             | 可选字符串：与 `content` 换行拼接后仅用于 **本轮** 智谱请求；**不**写入 `assistant_messages`，气泡与落库 user 正文仍为短 `content`（见 §13）。                          |
| **Flush / import-transcript**            | 首次保存成功后，把内存 `messages` 打成 `lines` 写入 `POST /assistant/session/import-transcript`。                                                                       |

---

## 2. 系统架构一览

```mermaid
flowchart LR
  subgraph FE[前端 apps/frontend]
    K[index.tsx 知识页]
    KA[KnowledgeAssistant.tsx]
    AS[store/assistant.ts]
    SSE[utils/assistantSse.ts]
    SVC[service/index.ts]
  end
  subgraph BE[后端 apps/backend]
    AC[AssistantController]
    ASV[AssistantService]
    DB[(assistant_sessions / assistant_messages)]
    GLM[智谱 chat/completions]
  end
  K --> KA
  KA --> AS
  AS --> SSE
  AS --> SVC
  SVC --> AC
  AC --> ASV
  ASV --> DB
  ASV --> GLM
```

---

## 3. 数据库与知识模块联动

### 3.1 表结构（TypeORM 实体）

- **`assistant_sessions`**（`assistant-session.entity.ts`）
  - `id`：UUID 主键，即前端 **`sessionId`**。
  - `user_id`：归属用户。
  - `knowledge_article_id`：与知识条目的 **逻辑绑定键**（可为云端知识 UUID、`__knowledge_trash__:回收站行id` 等，与前端 `bindingId` 对齐）。
  - `title` / `created_at` / `updated_at`。

- **`assistant_messages`**（`assistant-message.entity.ts`）
  - `session_id` → 会话外键，`onDelete: CASCADE`。
  - `role`：`user` / `assistant` / `system`。
  - `turn_id`：同一轮用户+助手共用，支持流式占位后 UPDATE 正文。
  - `content`：`longtext`。

### 3.2 删除知识时的清理

`KnowledgeService.remove`（`knowledge.service.ts`）在事务中：

1. 写入 `knowledge_trash` 快照；
2. **`assistantSessionRepo.delete({ knowledgeArticleId: row.id })`**：删除绑定该知识 UUID 的助手会话（消息随 CASCADE）；
3. 删除 `knowledge` 主表行。

因此删除后前端若仍持旧 `sessionId` 拉详情或点停止，后端对 **`getSessionDetail`** / **`stopStream`** 做了 **幂等软处理**（见 §10.3），避免 404 Toast。

---

## 4. 后端：路由、DTO、服务逻辑

### 4.1 控制器 `AssistantController`

路径：`apps/backend/src/services/assistant/assistant.controller.ts`。

- 全局 **`JwtGuard`**：所有路由需登录。
- **`ClassSerializerInterceptor`**：响应序列化（Date → ISO 等）。

**路由注册顺序（重要）**：`POST session/import-transcript` 与 `GET session/for-knowledge` 必须写在 **`GET session/:sessionId`** 之前，否则路径会被 `:sessionId` 误匹配为字面量 `import-transcript` / `for-knowledge`。

| 方法  | 路径                                              | 作用                                                                            |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| POST  | `/assistant/session`                              | 创建空会话；可带 `knowledgeArticleId` 绑定或复用最近会话。                      |
| POST  | `/assistant/session/import-transcript`            | 迁入草稿对话。                                                                  |
| GET   | `/assistant/sessions`                             | 分页会话列表。                                                                  |
| GET   | `/assistant/session/for-knowledge`                | 按 `knowledgeArticleId` 查最近会话+消息；无则 `data: null`。                    |
| GET   | `/assistant/session/:sessionId`                   | 按 sessionId 拉详情；会话已删则返回 `session: null, messages: []`（HTTP 200）。 |
| PATCH | `/assistant/session/:sessionId/knowledge-article` | 改绑 `knowledgeArticleId`。                                                     |
| POST  | `/assistant/sse`                                  | **Sse**：流式问答；body 为 `AssistantChatDto`。                                 |
| POST  | `/assistant/stop`                                 | 停止流式；会话已删则成功返回，不抛「会话不存在」。                              |

**SSE 包装**：`chatSse` 将 `chatStream` 的 chunk `map` 为 `{ data: { type, content?, raw?, done } } }`，末尾 `concat` 一条 `{ done: true }`；`catchError` 把异常转成 `data.error` + `done: true`，避免 Observable 断链导致前端挂死。

### 4.2 DTO 要点

- **`AssistantChatDto`**（`assistant-chat.dto.ts`）
  - `sessionId?`、`knowledgeArticleId?`、`ephemeral?`、`contextTurns?`、`content`（必填）、`maxTokens?`、`temperature?`。
  - **`ephemeral === true`** 时与 `sessionId` / `knowledgeArticleId` **互斥**，校验失败抛 `BadRequestException`。
  - `contextTurns`：多轮历史；**不含**本轮用户句——本轮由 **`content`** 表达；服务端 `buildEphemeralTurns` 会拼接为完整 turns 再送智谱。

- **`ImportAssistantTranscriptDto`**（`import-assistant-transcript.dto.ts`）
  - `knowledgeArticleId`：保存后的知识 id。
  - `lines`：最多 200 条，`user`/`assistant` 角色；超长时客户端提交 **按时间升序的最近 200 条**（`slice(-200)`）。

- **`AssistantStopDto`**：`sessionId`。

### 4.3 `AssistantService.chatStream` 分支摘要

路径：`apps/backend/src/services/assistant/assistant.service.ts`。

**A）`dto.ephemeral === true`**

1. 校验互斥字段。
2. **`runEphemeralChatStream`**：`buildEphemeralTurns` → token budget 裁剪 → 组装 `system + 历史` → `fetch` 智谱流式 → `parseGlmStreamData` → `subscriber.next`。
3. **不写** `assistant_sessions` / `assistant_messages`，**不**使用 Redis `streamBusyKey` / epoch（与持久化流区分）。

**B）持久化路径（`ephemeral` 非 true）**

1. 解析或创建 `AssistantSession`（`sessionId` 优先；否则 `knowledgeArticleId` 查最近；再无则新建并写 `knowledgeArticleId`）。
2. **`insertUserAndAssistantPlaceholder`**：事务内插入本轮 user + assistant 占位（`turnId` 一致）。
3. **`loadMessagesForSessionContext` + `buildTurnsForContext`**：从 DB 构建多轮上下文（流式中空助手可省略正文）。
4. **`incrementStreamEpoch` + cache.set(streamBusyKey)`**：多实例下抢占/中止同会话旧流。
5. 智谱流式读取循环中比对 epoch，必要时 **abort** 本地 fetch。
6. 正常结束 **`finalizeTurn`**（UPDATE 助手正文）；异常 **`cleanupTurnOnFailure`**（有则写部分，无则删 turn 对）。

### 4.4 `importTranscript`

1. `findLatestSessionIdByKnowledgeArticle(userId, articleId)`。
2. 无则 **新建** `AssistantSession` 并设 `knowledgeArticleId = articleId`；有则 **删光**该 session 下消息再插入。
3. 按 `lines` 扫描：**必须以 `user` 行开启一轮**；每条 user 后可选一条 `assistant`；写入 `turnId` 成对。
4. 更新 session `title`：取 **本批 `lines` 中** 首条有正文的 `user` 内容前 60 字（客户端超长时只提交最近 200 条，则标题对应该窗口内最早一轮用户句，而非整段草稿绝对首条）。
5. 返回 `{ sessionId, inserted }`。

### 4.5 `getSessionDetail` / `stopStream`（删除知识后的幂等）

- **`getSessionDetail`**：若会话行不存在，返回 **`{ session: null, messages: [] }`**（仍 200），避免前端 http 层对 404 弹 Toast。
- **`stopStream`**：若会话不存在，返回 **`{ success: true, message: '会话已不存在，无需停止' }`**；存在则读 Redis busy，无 busy 则「当前无进行中的生成」，有则 `incrementStreamEpoch` 通知读循环 abort。

---

## 5. 前端：页面编排与 documentKey

文件：`apps/frontend/src/views/knowledge/index.tsx`。

### 5.1 `assistantArticleBinding` 与 `documentKey`

摘录自 `apps/frontend/src/views/knowledge/index.tsx`（`assistantArticleBinding` 的 `useMemo` 定义）：

```tsx
/** 助手 / Monaco 文档维度的条目标识：回收站预览用独立前缀，避免多条均落在 draft-new 下同一会话 */
const assistantArticleBinding = useMemo(() => {
	if (knowledgeStore.knowledgeTrashPreviewId != null) {
		return `__knowledge_trash__:${knowledgeStore.knowledgeTrashPreviewId}`;
	}
	return knowledgeStore.knowledgeEditingKnowledgeId ?? "draft-new";
}, [
	knowledgeStore.knowledgeTrashPreviewId,
	knowledgeStore.knowledgeEditingKnowledgeId,
]);
```

- **回收站预览**：`knowledgeEditingKnowledgeId` 常为 `null`，用 **`__knowledge_trash__:{trashRowId}`** 与列表中正式 UUID 区分，使助手历史不串。
- **正式编辑**：binding 为云端 **`knowledgeEditingKnowledgeId`**（UUID）。
- **新建未保存**：binding 为字面量 **`draft-new`**。

`KnowledgeAssistant` 接收的 **`documentKey`** 为：

```text
`${assistantArticleBinding}__trash-${trashOpenNonce}`
```

**含义**：`trashOpenNonce` 在打开回收站条目等场景递增，用于 **同一 binding 下强制换「助手会话槽」**，避免 UI 状态与旧会话纠缠；**勿与** `clearDocumentNonce` 混用——后者仅驱动 Monaco `documentIdentity`，避免清空草稿时误 bump `trashOpenNonce` 导致助手被意外重置（注释见 `resetEditorToNewDraft`）。

### 5.2 保存知识：`persistKnowledgeApi` / `persistKnowledgeApiSaveAs`

新建成功分支（节选逻辑说明，非全文件）：

1. `saveKnowledge` → `articleId = res.data.id`。
2. `fromKey` / `toKey` 与上式 `documentKey` 规则一致。
3. **`!knowledgeAssistantPersistenceAllowed`** 时 **`await flushEphemeralTranscriptIfNeeded(articleId, fromKey, toKey)`**（须 **早于** `setKnowledgeEditingKnowledgeId`，否则 `activate` 可能拉空库覆盖内存草稿）。
4. `remapAssistantSessionDocumentKey`；`setKnowledgeEditingKnowledgeId`；若有 `sid` 再 **`patchAssistantSessionKnowledgeArticle`** 做幂等改绑。

### 5.3 清空草稿：`resetEditorToNewDraft`

顺序：`clearDocumentNonce++` → **`knowledgeStore.clearKnowledgeDraft()`** → 计算 **`nextAssistantDocumentKey = knowledgeAssistantDocumentKey(knowledgeAssistantArticleBinding(...), trashOpenNonce)`** → **`assistantStore.clearAssistantStateOnKnowledgeDraftReset(nextAssistantDocumentKey)`**。

**原因**：未保存草稿清空后 `documentKey` 往往仍为 `draft-new__trash-*`，`KnowledgeAssistant` 内 **`useEffect([documentKey, ...])` 不会**重跑；必须 **显式** 清助手内存态（含 ephemeral）。**传入 `nextAssistantDocumentKey`**：在 **`activeDocumentKey` 已与 props 对齐** 且 **`editorHasBody === false`** 时，组件侧会 **短路 `activateForDocument`**（见 §8.0.1），避免二次清空或误拉 `draft-new` 会话。

---

## 6. 前端：assistantStore 状态机

文件：`apps/frontend/src/store/assistant.ts`。本节与当前类实现 **逐行对齐**：核心是 **按「规范化文档键 canonicalKey」隔离每篇文档的运行态**，**切换文档不中断其它文档的 SSE**；`activeDocumentKey` 仅表示 **当前 UI 指针**（可为带 `__trash-*` 后缀的完整 `documentKey`）。

### 6.1 导出形态：`AssistantStoreApi` 与默认实例

- **`AssistantStore`**：MobX `makeAutoObservable` 的具体类，含 `private` 成员（`canonicalKey`、`ensureState`、`activeState`、`fetchSessionMessagesForDocumentKey` 等）。
- **`AssistantStoreApi`**：对外 **仅暴露公开 API 的 interface**，避免 `useStore()` 等处的导出类型把 **private 成员** 带进匿名类类型，触发 **TS4094**。
- **`const _assistantStore = new AssistantStore()`**，再 **`export const assistantStore: AssistantStoreApi = _assistantStore`** 与 **`export default assistantStore`**：`KnowledgeAssistant` 使用默认导出即可。

### 6.2 双键模型：`activeDocumentKey` vs `canonicalKey(documentKey)`

- **`knowledgeArticleBindingFromDocumentKey(documentKey)`**（模块级）：若 `documentKey` 含子串 **`__trash-`**，则取 **该子串之前** 的前缀并 `trim()`；否则整串 `trim()`。用于 **后端按文章查会话**、**状态桶 key** 等「稳定条目标识」。
- **`canonicalKey(raw)`**（类 `private`）：对入参 `trim()`；若为空返回 `''`；否则 **`knowledgeArticleBindingFromDocumentKey(raw) || raw`**。  
  **`stateByDocument` / `sessionByDocument` 一律以 canonicalKey 为键**，这样 `draft-new__trash-A` 与 `draft-new__trash-B` 共享同一运行态，避免切换回收站视图 nonce 时对话丢失或重复 hydrate。
- **`activeDocumentKey`**：`activateForDocument` 写入的是 **调用方传入的 `nextKey`（trim 后）**，**不**剥 `__trash-*`。因此「当前 props 的 `documentKey`」与 MobX 里 active 指针一致，便于 `ensureSessionForCurrentDocument` 里用 **`knowledgeArticleBindingFromDocumentKey(key)`** 得到绑定 id。

### 6.3 每文档状态：`stateByDocument` 与 `sessionByDocument`

**`private stateByDocument: Record<canonicalKey, { ... }>`** 每个桶包含：

| 字段 | 说明 |
| --- | --- |
| `sessionId` | 该文档持久化会话 id；ephemeral 阶段多为 `null`。 |
| `messages` | 该文档下的 `Message[]`；与当前 UI 是否聚焦无关，**切走文档后仍保留**（含流式中）。 |
| `isHistoryLoading` / `isSending` / `loadError` / `abortStream` | 该文档桶内的请求与流式句柄。 |
| `historyHydrated` | **已为该文档尝试过**「拉服务端历史 / 判定无会话」；为 `true` 时 **`activateForDocument` 不再重复请求**（避免频繁 effect 打爆接口）。 |
| `pendingEphemeralFlush` | 首次保存时若仍在流式：**延迟迁入** 任务 `{ cloudArticleId, fromDocumentKey, toDocumentKey }`；挂在 state 上以便 **`remapAssistantSessionDocumentKey` 时随 state 迁移**。 |

**`sessionByDocument: Record<canonicalKey, string>`**：canonicalKey → sessionId 的内存缓存；换篇后其它 key 的映射仍保留。

**`private get activeState()`**：`ensureState(this.activeDocumentKey)`——注意参数是 **可能含 trash 后缀的 activeDocumentKey**；`ensureState` 内部会先 **`canonicalKey(documentKey)`** 再取桶。

**只读 getter**（`sessionId`、`messages`、`isHistoryLoading`、`isSending`、`loadError`、`abortStream`）均代理 **`activeState`**，因此 UI 永远读写 **当前 active 文档桶**。

**`get isStreaming()`**：`this.messages.some(m => m.isStreaming)`，仅看 **当前 active 文档**。

### 6.4 全局标志：`knowledgeAssistantPersistenceAllowed`

- 默认 **`true`**。
- **`setKnowledgeAssistantPersistenceAllowed`**：`runInAction` 写入布尔。
- **`sendMessage`** 内 **`ephemeral = !this.knowledgeAssistantPersistenceAllowed`**：为 `true` 时走持久化（`sessionId` + 落库）；为 `false` 时走 **`streamAssistantSse` 的 `ephemeral: true`** + `contextTurns`，**不传 `sessionId`**。

### 6.5 模块级工具函数（避免 TS4094 + 与后端上限对齐）

与 §6.1 同理，下列函数放在 **类外**（不作为 `private` 方法导出）：

- **`readToken()`**：`localStorage.getItem('token')`（无 `window` 时返回 `''`）。
- **`mapApiMessagesToUi(rows)`**：过滤 `role` 为 `user`/`assistant`；映射为 `Message`（`id`/`chatId` 用服务端 `id`，`isStreaming: false`）。
- **`knowledgeArticleBindingFromDocumentKey`**：见 §6.2。
- **`buildImportTranscriptLinesFromMessages(messages)`**：逐条收集 user/assistant 的 `content`；**`lines.slice(-200)`** 与 `ImportAssistantTranscriptDto` 的 `@ArrayMaxSize(200)` 对齐（**时间顺序保留，取末尾窗口**）。
- **`buildEphemeralContextTurnsFromMessages(messages)`**：同上角色过滤；**跳过** `assistant && isStreaming && !(content).trim()` 的空占位；结果 **`slice(-120)`** 与 ephemeral `contextTurns` 上限对齐。

### 6.6 `isStreamingForDocumentKey` / `scheduleEphemeralFlushAfterStreaming`

- **`isStreamingForDocumentKey(documentKey)`**：对参数做 `canonicalKey`，若桶存在则 **`messages.some(m => m.isStreaming)`**。供知识保存逻辑判断「是否应延迟迁入」。
- **`scheduleEphemeralFlushAfterStreaming(cloudArticleId, fromDocumentKey, toDocumentKey)`**：对 **`fromDocumentKey`** 取 `ensureState` 后 `runInAction`：设置 **`pendingEphemeralFlush`**，并 **`historyHydrated = true`**。含义：保存后即将允许持久化，若立刻按文章拉历史会得到 **空会话**，易覆盖 UI；先标 hydrated，等 **流式结束** 后在 `onComplete` 里 **`flushEphemeralTranscriptIfNeeded`**。

### 6.7 `activateForDocument(documentKey)`（当前实现逐步）

**不**在入口处 `abortStream`、**不**清空消息——换文档只 **切换指针并确保桶存在**，其它文档上的 SSE 继续跑。

1. `nextKey = (documentKey ?? '').trim()`；空则 return。
2. `docKey = this.canonicalKey(nextKey)`。
3. **`runInAction`**：`this.activeDocumentKey = nextKey`；**`this.ensureState(docKey)`**（无 key 时 `ensureState` 返回临时空对象，不写入 `stateByDocument`）。
4. `const state = this.ensureState(docKey)`。
5. 若 **`!this.knowledgeAssistantPersistenceAllowed`**：return（不拉后端；草稿仅内存）。
6. 若 **`!readToken()`**：return。
7. 若 **`state.historyHydrated === true`**：return（**已 hydrate 过**，避免重复 `getAssistantSessionByKnowledgeArticle` / `getAssistantSessionDetail`）。
8. **`sid`** 初值：`this.sessionByDocument[docKey] ?? state.sessionId ?? null`。
9. 若 **尚无 `sid`** 且 **`bindingId = knowledgeArticleBindingFromDocumentKey(nextKey)`** 非空：
   - `runInAction`：`state.isHistoryLoading = true`。
   - **`await getAssistantSessionByKnowledgeArticle(bindingId)`**。
   - 若 `data?.session?.sessionId`：`sid` 赋值；`runInAction` 写入 `sessionByDocument[docKey]`、`state.sessionId`、`state.messages = mapApiMessagesToUi(data.messages ?? [])`，**`hydratedFromArticleApi = true`**。
   - `finally`：`state.isHistoryLoading = false`。
10. 若 **仍无 `sid`**：`runInAction` **`state.historyHydrated = true`**；return（**空会话**，等用户首条 `sendMessage` 时 `createAssistantSession`）。
11. 若 **`hydratedFromArticleApi`**：`runInAction` **`state.historyHydrated = true`**；return（**不再**调用 `fetchSessionMessages`，避免二次请求）。
12. 否则（内存里已有 sid，且不是刚由 for-knowledge 一次性灌入）：`runInAction` 设置 `state.sessionId = sid`、`state.isHistoryLoading = true`；**`await this.fetchSessionMessages()`**（内部用当前 `activeDocumentKey` 解析 canonical 再拉详情）。
13. `try/catch`：失败时 `runInAction` **`delete sessionByDocument[docKey]`**、**`state.sessionId = null`**、**`state.messages = []`**（脏 sid 丢弃）。
14. `finally`：`state.isHistoryLoading = false`；**`state.historyHydrated = true`**。

### 6.8 `remapAssistantSessionDocumentKey(fromKey, toKey)`

`from`/`to` 为 **`canonicalKey(fromKey)`** / **`canonicalKey(toKey)`**。若缺失或 `from === to`：仅当 **`activeDocumentKey === fromKey`** 时把 **`activeDocumentKey` 改为 `toKey`**（无前缀迁移需求时）。否则 **`runInAction`**：迁移 **`sessionByDocument`** 与 **`stateByDocument`** 中 `from` → `to` 的条目并删除 `from`；若 **`activeDocumentKey === fromKey`** 则 **`activeDocumentKey = toKey`**。

### 6.9 `clearAssistantStateOnKnowledgeDraftReset(syncActiveDocumentKey?)`

用于 **`documentKey` 不变**（如仍为 `draft-new__trash-*`）但左侧已清空草稿的场景：`useEffect([documentKey])` **不会**再触发 `activate`，必须 **显式** 清助手。

1. `rawKey = this.activeDocumentKey`，`key = canonicalKey(rawKey)`，`state = key ? ensureState(key) : null`，`prevSid = state?.sessionId ?? null`。
2. **`state?.abortStream?.()`**，并 **`state.abortStream = null`**。
3. **`runInAction`**：若 `key` 存在则 **`delete stateByDocument[key]`**、**`delete sessionByDocument[key]`**；若传入 **`syncActiveDocumentKey?.trim()`** 则 **`activeDocumentKey = next`** 并 **`ensureState(next)`**（避免后续 getter 空引用）。
4. 若 **`prevSid`**：`void stopAssistantStream(prevSid).catch(() => {})`（尽力通知后端停流）。

### 6.10 `fetchSessionMessages` / `fetchSessionMessagesForDocumentKey`

- **`fetchSessionMessages()`**：取 **`this.activeDocumentKey`**，调用 **`fetchSessionMessagesForDocumentKey(key)`**。
- **`fetchSessionMessagesForDocumentKey(documentKey)`**（`private`）：
  - `key = canonicalKey(documentKey)`；`state = ensureState(key)`；无 **`state.sessionId`** 则 return。
  - **`await getAssistantSessionDetail(state.sessionId)`**。
  - 若 **`!payload?.session`**（会话已删，后端 200 返回空 session）：**`runInAction`** **`delete sessionByDocument[key]`**、**`delete stateByDocument[key]`**（整桶移除，与 §4.5 对齐）。
  - 若有 **`payload.messages`**：**`runInAction`** `state.messages = mapApiMessagesToUi(...)`，`state.historyHydrated = true`。

### 6.11 `flushEphemeralTranscriptIfNeeded` / `ensureSessionForCurrentDocument`

- **`flushEphemeralTranscriptIfNeeded(cloudArticleId, fromDocumentKey, toDocumentKey)`**：无 token 则 return。`from`/`to` 为两参数的 canonical；**`sourceState = stateByDocument[from] ?? stateByDocument[to] ?? ensureState(fromDocumentKey)`**（兼容保存流程中已 remap）。**`lines = buildImportTranscriptLinesFromMessages(sourceState.messages)`**，空则 return。`await importAssistantTranscript({ knowledgeArticleId, lines })`；若返回 **`sessionId`**：`runInAction` 更新 **`sessionByDocument[to]`**、**`toState.sessionId`**、**`historyHydrated = true`**、**`pendingEphemeralFlush = null`**，并可能把 **`activeDocumentKey`** 从 `fromDocumentKey` 改为 `toDocumentKey`。
- **`ensureSessionForCurrentDocument()`**：若不允许持久化 return `null`；无 token Toast「请先登录…」；无 **`activeDocumentKey`** Toast「文档未就绪」；若已有 **`state.sessionId` 或 `sessionByDocument[canonical]`** 则同步到 `state.sessionId` 并返回；否则 **`createAssistantSession`**（`knowledgeArticleBindingFromDocumentKey(key)` 有值则传入 **`knowledgeArticleId`**），成功后写入映射并 **`historyHydrated = true`**。

### 6.12 `sendMessage(raw?, options?)`

1. **`documentKey = activeDocumentKey.trim()`**；空则 Toast「文档未就绪」。
2. **`canonical = canonicalKey(documentKey)`**，**`state = ensureState(canonical)`**。
3. **`text = (raw ?? '').trim()`**；若 **`!text || state.isSending || state.isHistoryLoading`** 则 return（防抖）。
4. **`extraUserContentForModel = options?.extraUserContentForModel?.trim()`**（可选）。
5. **`ephemeral = !knowledgeAssistantPersistenceAllowed`**。非 ephemeral：**`sid = await ensureSessionForCurrentDocument()`**，失败 return。ephemeral：无 token Toast 后 return。
6. **`contextTurns = ephemeral ? buildEphemeralContextTurnsFromMessages(state.messages) : undefined`**（在 push **之前** 快照历史）。
7. **`state.abortStream?.()`** 并清空 **本桶** `abortStream`（只打断 **当前文档** 的上一次 SSE，不影响其它 canonical 桶）。
8. **`userChatId` / `assistantChatId`**：`uuidv4()`。
9. **`runInAction`**：`state.isSending = true`；`push` user（`content: text`）；`push` assistant 占位（`content: ''`，**`isStreaming: true`**，**`thinkContent: ''`**）。
10. **`applyAssistantPatch(delta, thinkDelta?)`**：累加 `accumulated` / `thinkBuf`；**`runInAction`** 内按 **`assistantChatId`** 找到下标，**`state.messages[idx] = { ...prev, content, thinkContent }`**（**替换元素**触发细粒度更新）。
11. **`await streamAssistantSse`**：
    - ephemeral：**`{ ephemeral: true, content: text, contextTurns, ...可选 extraUserContentForModel }`**。
    - 持久化：**`{ sessionId: sid, content: text, ...可选 extraUserContentForModel }`**。
12. 返回的 **`abort`** 赋给 **`state.abortStream`**（注意：setter 写到 **activeState**，发送时 active 应已是该文档）。
13. **`onComplete(err)`**（异步回调）：
    - **`runInAction`**：`state.isSending = false`；找到 assistant 占位，**`isStreaming: false`**；若 `err` 则正文补 **`生成失败：${err}`** 且 **`isStopped: true`**；**整对象替换**。
    - **`state.abortStream = null`**。
    - 若存在 **`state.pendingEphemeralFlush`** 且 **当前桶内已无 `isStreaming`**：**`await flushEphemeralTranscriptIfNeeded(...)`**，**`finally`** 里 **`pendingEphemeralFlush = null`**。
    - 若 **无 err 且非 ephemeral**：**`await fetchSessionMessagesForDocumentKey(canonical)`** 与 DB 对齐（失败忽略，UI 已展示累积正文）。
14. **`onError`**：`isSending = false`、助手气泡收尾、**`abortStream = null`**、**`pendingEphemeralFlush = null`**（**错误时不自动迁入**，避免不完整对话绑定到新文章）。
15. 外层 **`catch`**：同样收尾 **`isSending`** 与占位 **`isStreaming: false`**。

### 6.13 `stopGenerating`

1. **`this.abortStream?.()`** 然后 **`this.abortStream = null`**（注释：**先**断 SSE，避免 await **`stopAssistantStream`** 期间仍 apply delta 导致 `...prev` 仍 `isStreaming: true`）。
2. **`runInAction`**：**`this.isSending = false`**（走 active getter）；**`this.messages = this.messages.map(m => m.isStreaming ? { ...m, isStreaming: false, isStopped: true } : m)`**（**替换数组**保证切换/映射时 UI 一致）。
3. **`const sid = this.sessionId`**；有则 **`await stopAssistantStream(sid)`**（失败忽略）。

### 6.14 修复：点击「停止」不再清空已接收流式正文（停止后只剩「思考中」问题）

#### 6.14.1 现象与调用链

在知识库助手里点击「停止」时，前端会依次发生：

- 先 **中止 SSE（Server-Sent Events，服务器推送事件）**：`abortStream()` → `AbortController.abort()`
- 再调用后端停止接口：`/api/assistant/stop`
- 随后某些逻辑会继续调用会话详情：`/api/assistant/session/:sessionId`

问题表现为：**前端界面上已经接收到的 assistant 正文被清空/回退**，只剩下思考区（`thinkContent`）或「思考中」占位，导致用户误以为没有输出。

#### 6.14.2 根因（为什么会“停止后被覆盖”）

核心原因是「用户主动停止」在旧实现里被当作「正常完成且无错误」处理，从而触发了“用服务端会话对齐覆盖本地消息”的逻辑：

- `streamAssistantSse` 在捕获到 `AbortError`（用户停止导致）时会调用 `finish()`。
- `finish()` 默认会 `onComplete()` **不带参数**，于是 `onComplete(err)` 里的 `err === undefined`。
- `sendMessage` 的 `onComplete` 里有「`!err && !ephemeral` 时拉会话详情并覆盖本地 messages」的逻辑。
- **停止瞬间后端往往还没把本轮 assistant 的流式片段落库**（或只落库了部分），会话详情返回的 messages 比本地已累积的短。
- `fetchSessionMessagesForDocumentKey` 会用接口返回的 messages **整表替换** `state.messages`，于是本地刚刚显示的已接收正文被覆盖掉。

一句话：**“用户停止”被误判为“成功完成” → 触发 fetchSessionMessages → 用未落库/不完整的服务端历史覆盖了本地已生成内容。**

#### 6.14.3 修复策略（不影响现有功能的前提）

我们需要在“用户主动停止”与“正常完成”之间做出可区分的信号，并保证：

- **正常完成**（`done === true` 或流自然结束）仍然会 `fetchSessionMessagesForDocumentKey` 做服务端对齐，保持原有一致性。
- **用户停止**（`AbortError`）不再触发对齐覆盖（因为对齐数据很可能不完整），从而保留本地已接收正文。

实现上采用 **哨兵值（sentinel，哨兵字符串）**：

- SSE 层在 `AbortError` 时 `onComplete(ASSISTANT_SSE_USER_ABORT_MARKER)`。
- Store 层识别到该哨兵后：
  - 不把它当成真实错误文案写到气泡里
  - 不走 “无 err → fetchSessionMessages” 的覆盖对齐路径

#### 6.14.4 关键实现代码（含详细中文注释）

**① SSE 层：为用户停止提供“可识别的完成原因”**

文件：`apps/frontend/src/utils/assistantSse.ts`

```ts
// 用户主动 `abort()` 时传给 `onComplete` 的哨兵值（非后端错误文案）。
// 业务侧应跳过「成功后拉会话对齐」等逻辑，避免服务端尚未落库时覆盖本地已生成片段。
export const ASSISTANT_SSE_USER_ABORT_MARKER =
	'__FRONT_ASSISTANT_SSE_USER_ABORT__';

// ...

} catch (err: unknown) {
	// 关键：AbortError 不是“正常完成”，它意味着用户点了停止。
	// 如果这里调用 finish()（不带参数），上层会误以为 err 为空，从而去拉 session 对齐并覆盖 UI。
	if (err instanceof DOMException && err.name === 'AbortError') {
		// 传入哨兵值，让上层能区分“用户停止”与“自然完成”
		finish(ASSISTANT_SSE_USER_ABORT_MARKER);
		return;
	}
	// 非 AbortError 才走真正的 onError（例如网络错误、解析异常等）
	const e =
		err instanceof Error ? err : new Error(String(err ?? '请求中断'));
	onError?.(e);
}
```

**② Store 层：识别“用户停止”，避免用服务端会话覆盖本地已接收正文**

文件：`apps/frontend/src/store/assistant.ts`

```ts
import {
	ASSISTANT_SSE_USER_ABORT_MARKER,
	streamAssistantSse,
} from '@/utils/assistantSse';

// ...

onComplete: async (err) => {
	// 是否为“用户主动停止”的哨兵值
	const userAborted = err === ASSISTANT_SSE_USER_ABORT_MARKER;

	runInAction(() => {
		state.isSending = false;
		const idx = state.messages.findIndex((m) => m.chatId === assistantChatId);
		if (idx >= 0) {
			const prev = state.messages[idx] as Message;
			const next: Message = {
				...prev,
				isStreaming: false, // 无论自然完成/失败/停止，都要结束流式态
			};

			// 关键：用户停止时 err 是哨兵值，不应当显示“生成失败：xxx”
			// 同时也不应当标记 isStopped（这里的 isStopped 语义是“失败/异常中止”）
			if (err && !userAborted) {
				next.content = next.content || `生成失败：${err}`;
				next.isStopped = true;
			}

			// 替换对象以确保 MobX 订阅与 UI 渲染稳定
			state.messages[idx] = next;
		}
	});

	state.abortStream = null;

	// ...（pendingEphemeralFlush 逻辑保持不变）

	// 关键：只有“真正无 err 的自然完成”才去拉会话详情做服务端对齐。
	// 用户主动停止时，服务端可能尚未落库本轮输出，拉取会导致用不完整历史覆盖 UI。
	if (!err && !ephemeral) {
		try {
			await this.fetchSessionMessagesForDocumentKey(canonical);
		} catch {
			// 忽略：界面已展示累积正文
		}
	}
},
```

#### 6.14.5 行为验证（预期结果）

- 点击「停止」后：
  - UI 中 **已经接收到的 assistant 正文仍保留**（不再被清空/回退）
  - 不会出现把哨兵值当作错误文案显示
  - 仍会调用 `/api/assistant/stop`（原有功能不变）
- 不点击停止、让流自然完成时：
  - 仍会在完成后 `fetchSessionMessagesForDocumentKey` 与服务端落库历史对齐（原有功能不变）

---

## 7. 前端：SSE 消费协议 `streamAssistantSse`

文件：`apps/frontend/src/utils/assistantSse.ts`。

### 7.1 传输层

- `POST BASE_URL + '/assistant/sse'`，`Authorization: Bearer` + `Content-Type: application/json`。
- `getPlatformFetch`：兼容 Tauri / 浏览器 fetch。
- `AbortController`：返回 `() => controller.abort()` 供停止。
- `AbortError`：用户点「停止」触发；会 `onComplete(ASSISTANT_SSE_USER_ABORT_MARKER)`（**哨兵值**），用于区分“用户停止”与“自然完成”，避免停止后用服务端历史覆盖本地已接收片段。

### 7.2 行协议（与主 Chat 不同）

按 **换行** 切分 buffer；只处理 **`data:` 前缀** 行；`JSON.parse` 后：

| `parsed` 字段                               | 处理                                            |
| ------------------------------------------- | ----------------------------------------------- |
| `error`（string）                           | `onComplete(error)` 并结束 readLoop。           |
| `done === true`                             | `onComplete()` 正常结束。                       |
| `type === 'thinking'`                       | 从 `raw` 或 `content` 取字符串 → `onThinking`。 |
| `type === 'usage'`                          | 忽略。                                          |
| `type === 'content'` 且 `content` 为 string | `onDelta(content)`。                            |

解析失败 Toast「助手流解析失败」并 **continue**（尽力容错）。

---

## 8. 前端：`KnowledgeAssistant` UI 层

文件：`apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx`。根组件 **`KnowledgeAssistant`** 与 **`KnowledgeAssistantMessageBubble`** 均为 **`observer`**，直接订阅 **`assistantStore`**（默认 import），与 **`useStore()`** 解构的 **`knowledgeStore` / `userStore`** 组合成页面逻辑。

### 8.0 Props、受控输入与派生状态

**`KnowledgeAssistantProps`**

| Prop | 类型 | 说明 |
| --- | --- | --- |
| `documentKey` | `string` | **必填**。与 Markdown 编辑器 **`documentIdentity`** 一致；驱动 **`activateForDocument`** 与 **`useStickToBottomScroll` 的 `resetKey`**。 |
| `input` | `string` | **可选**。传入则由父组件 **受控** 助手输入框（知识页把状态抬到 `index.tsx`，便于编辑器右键等外部入口写草稿）。 |
| `setInput` | `(value: string) => void` | **可选**。与 `input` 成对使用；不传则组件内 **`useState('')`** 非受控。 |

**派生**

- **`isLoggedIn`**：`Boolean(userStore.userInfo?.id)`。
- **`editorHasBody`**：`Boolean((knowledgeStore.markdown ?? '').trim())`——既影响 **占位与快捷卡片** 是否出现，也驱动 **`ChatEntry.disableTextInput`** 与 **发送前校验**（快捷卡片会 Toast「请先在左侧编辑器输入正文」）。
- **`messages`**：`assistantStore.messages`（MobX，observer 自动追踪）。
- **`streamScrollTick`**（与贴底 hook、代码块 toolbar、角标刷新共用）：  
  - 有最后一条消息时：`` `${messages.length}:${lastMsg.chatId}:${lastMsg.content.length}:${lastMsg.thinkContent?.length ?? 0}:${lastMsg.isStreaming ? 1 : 0}` ``  
  - 否则：`String(messages.length)`。  
  语义：**消息列表版本戳**，流式阶段随 `content` / `thinkContent` / `isStreaming` 变化，驱动 **`useStickToBottomScroll` 的 `contentRevision`** 与布局类 effect。

### 8.0.1 `activateForDocument` 的 `useEffect`（与 `editorHasBody` 的短路）

```tsx
useEffect(() => {
	if (!documentKey) return;
	if (assistantStore.activeDocumentKey === documentKey && !editorHasBody) {
		return;
	}
	void assistantStore.activateForDocument(documentKey);
}, [documentKey, editorHasBody, assistantStore.activeDocumentKey]);
```

- **首段**：`documentKey` 为空不激活。
- **第二段（关键）**：当 **当前 store 的 `activeDocumentKey` 已与 props 一致** 且 **`editorHasBody === false`** 时 **不再调用 `activate`**。  
  **原因**：清空草稿后 **`clearAssistantStateOnKnowledgeDraftReset(nextKey)`** 会把 `activeDocumentKey` 同步到下一 key；此时左侧无正文，若再 `activate` 会 **二次清空** 并可能错误去拉 **`draft-new`** 会话。未保存草稿的 key（`draft-new__trash-*`）在 **有正文** 时仍会走 `activate`，保证 **`activeDocumentKey` 写入**（否则 ephemeral 发送会 Toast「文档未就绪」——见组件文件头注释）。

### 8.1 持久化开关同步、复制态清理、左侧清空输入防抖

**`assistantPersistenceAllowed`（`useMemo`）** 与源码一致：

- **`knowledgeTrashPreviewId != null`** → **`true`**（回收站预览允许持久化）。
- 否则若 **`isKnowledgeLocalMarkdownId(editingId)`** → **`true`**（本地 Markdown 条目，与云端 UUID 区分）。
- 否则若 **`knowledgeEditingKnowledgeId` 真值** → **`true`**（已绑定可落库 id）。
- 否则 **`false`**（典型：**新建未保存云端草稿**，仅 `draft-new`）。

**`useEffect` 同步到 store**：挂载时 **`assistantStore.setKnowledgeAssistantPersistenceAllowed(assistantPersistenceAllowed)`**；**卸载 cleanup** 调 **`setKnowledgeAssistantPersistenceAllowed(true)`**，避免离开知识页后全局误保持「禁止持久化」。

**复制反馈**：`isCopyedId` state + **`copyTimerRef`**；**`onCopy`** 写剪贴板、`setIsCopyedId(chatId)`、**500ms** 后清空；组件 **卸载 `useEffect`** 里 **`clearTimeout(copyTimerRef)`**。

**左侧 `markdown` 变空时清空助手输入**（避免禁用输入后仍残留草稿）：

- 若 **`(knowledgeStore.markdown ?? '').trim()`** 非空：直接 return。
- 否则 **`setTimeout(200ms)`** 后再检测一次仍为空才 **`setInput('')`**。  
  **原因**（源码注释）：开启助手会导致 Monaco 视图切换与 **重挂载**，父级 `markdown` 可能出现 **极短暂空串**；若立即清空会造成「刚粘贴进输入框就被清掉」。

### 8.2 单条气泡 `KnowledgeAssistantMessageBubble`

- **`observer`** 子组件；**`message = assistantStore.messages.find(m => m.chatId === chatId)`**，找不到 return `null`。
- **`streamRev` / `data-msg-rev`**：  
  - **assistant**：`` `${content.length}:${thinkContent?.length ?? 0}:${isStreaming ? 1 : 0}` ``  
  - **user**：`` `${content.length}` ``  
  绑定到 DOM **`data-msg-rev`**，使 MobX 在流式阶段 **稳定订阅** 正文长度、思考区长度与流式标记（注释：**消息内容版本戳**，语义化依赖，非 hack 预读）。
- **布局**：根 `div` 使用 **`min-w-0 max-w-full flex-1`** 等，避免 flex 子项被代码块/长行 **撑破 ScrollArea**；用户气泡 **`items-end`**，气泡容器用户侧 **`w-fit self-end`** + 青色浅底边框，助手侧 **`flex-1`** + theme 浅底。
- **`ChatAssistantMessage`**：用户消息传入额外 **`className`** 约束 markdown-body 的 **`min-w-0` / `max-w-full` / `overflow-x-auto`**；助手消息传入 **`scrollViewportRef`**，供 **代码块吸顶条** 与 **MdPreview 懒挂载**。
- **`ChatMessageActions`**：绝对定位在气泡 **`message-md-wrap`** 下方（`-bottom-9`）；用户 **`right-0`**，助手 **`left-0`**；**`needShare={false}`**；**`onSaveToKnowledge`** 由父级传入（见下）。

**`onSaveToKnowledge`（父组件 `useCallback`）**：取 **`message.content`** trim，空则 Toast「没有可写入的正文」；否则 **`cur = knowledgeStore.markdown.trimEnd()`**，若 **`cur`** 非空则 **`next = cur + 两个换行 + body + 单个换行`**，否则 **`next = body + 单个换行`**，再 **`knowledgeStore.setMarkdown(next)`**，Toast「已追加到当前知识文档」。

### 8.3 滚动、贴底、代码块浮动工具栏

**`useStickToBottomScroll`**（`apps/frontend/src/hooks/useStickToBottomScroll.ts`）入参：

- **`isStreaming: assistantStore.isStreaming`**
- **`contentRevision: streamScrollTick`**
- **`resetKey: documentKey || undefined`**（换文档重置 hook 内部滚动状态）

解构：**`viewportRef` → `scrollViewportRef`**、**`scrollViewportHandlers`**、**`enableStickToBottom` → `enableStreamStickToBottom`**、**`disableStickToBottom` → `disableStreamStickToBottom`**、**`flushScrollToBottom`**。

- **`sendMessage` / `sendKnowledgePromptCard`** 在发消息前调用 **`enableStreamStickToBottom()`**，保证发完后流式跟底。
- **角标「置顶」**前须 **`disableStreamStickToBottom()`**（见 §8.6），否则下一 token 会 **`useLayoutEffect`** 把视口拉回底部。

**`useChatCodeFloatingToolbar`**（`scrollViewportRef as RefObject<HTMLElement | null>`）：

- **`layoutDeps: [streamScrollTick, documentKey, messages.length]`**——助手正文/流式增量会变高，**勿仅用 `knowledgeStore.markdown`**，否则代码块工具条不重排。
- **`passiveScrollLayout: true`**，**`passiveScrollDeps: [documentKey, messages.length, streamScrollTick, assistantStore.isStreaming]`**——滚动时由父级统一 **`relayout`**（见下）。

**`scrollAreaHandlers`（`useMemo`）**：从 **`scrollViewportHandlers`** 拆出 **`onScroll`**，包装为：

1. **`onViewportScroll(e)`**（贴底状态机）
2. **`relayoutCodeToolbar()`**
3. **`refreshScrollCornerFab()`**

展开到 **`<ScrollArea {...scrollAreaHandlers} />`**，并设置 **`viewportClassName="pb-1 [overflow-anchor:none]"`**（关闭 overflow-anchor，减少浏览器自动滚动锚点干扰）、**`className="min-h-0 flex-1"`**、**`ref={scrollViewportRef}`**。

**页面结构**：根 **`relative flex h-full w-full flex-col overflow-hidden`**；顶部 **`ChatCodeFloatingToolbar`**（与 hook 配套）；中间历史区或空态；底部 **`ChatEntry`** 包在 **`isLoggedIn`** 条件内（未登录整块输入区不渲染——与知识页 **`bottomBarAssistantNode`** gate 叠加时，以入口层为准）。

### 8.4 空会话 UI、首屏快捷卡片与 `sendMessage` / `sendKnowledgePromptCard`

**分支一：`assistantStore.isHistoryLoading`**

- 中间区 **`flex-1` 居中**，渲染 **`<Loading text="正在加载对话…" />`**（`@design/Loading`），不展示消息列表与空态文案。

**分支二：`!messages.length`（且无历史加载）**

- **外层**：`text-textcolor/70`、`pt-4 pl-4 pr-4.5`、`items-start justify-center`。
- **若 `knowledgeStore.markdown` 为真**（注意：此处用 **truthy**，与 `editorHasBody` 的 trim 略有不同——空字符串才走欢迎语）：
  - 展示 **两列并排** **`KNOWLEDGE_ASSISTANT_PROMPTS.map`**：每项为 **`type="button"`**，**`flex-1`**，**`item.icon`**（`Sparkle` / `Sparkles`）+ 标题 + 描述。
  - 当 **`isSending || isHistoryLoading || isStreaming`**：整卡 **`pointer-events-none opacity-50`**，禁止连点。
  - **`onClick={() => void sendKnowledgePromptCard(item.kind)}`**。
- **否则**（左侧无 markdown 字符串）：展示带 **`Sparkles`** 图标的欢迎说明文案（「Hi，我是您的专属知识库助手！…」），背景 **`bg-theme/5`**、边框 **`border-theme/10`**。

**`sendMessage(content?: string)`（`useCallback`）**

1. **`text = (content ?? input).trim()`**，空则 return。
2. **`!isLoggedIn`**：Toast「请先登录后再使用助手」；return。
3. **`setInput('')`**（发送前清空输入框）。
4. **`enableStreamStickToBottom()`**。
5. **`await assistantStore.sendMessage(text)`**（无第二参数——普通键盘发送不带 `extraUserContentForModel`）。

依赖数组：`[input, isLoggedIn, enableStreamStickToBottom]`（**未**列入 `setInput`：父级受控时由父级 setter 稳定引用）。

**`sendKnowledgePromptCard(kind)`（`useCallback`）**

1. **`!isLoggedIn`**：同上 Toast。
2. **`md = (knowledgeStore.markdown ?? '').trim()`**，空则 Toast「请先在左侧编辑器输入正文」。
3. 若 **`isSending || isHistoryLoading || isStreaming`**：Toast「请等待当前回复结束后再试」。
4. **`buildKnowledgeAssistantDocumentMessage(kind, knowledgeStore.markdown ?? '')`** 得到 **`userMessageShort`** 与 **`extraUserContentForModel`**（定义见 **`apps/frontend/src/views/knowledge/utils.ts`**，常量 **`KnowledgeAssistantPromptKind`** 见 **`constants.ts`**）。
5. **`enableStreamStickToBottom()`**。
6. **`await assistantStore.sendMessage(userMessageShort, { extraUserContentForModel })`**。

依赖：`[isLoggedIn, knowledgeStore.markdown, enableStreamStickToBottom]`。

**`stopGenerating`**：`void assistantStore.stopGenerating()`，作为 **`ChatEntry`** 的 **`stopGenerating`** 传入条件：**仅当 `assistantStore.isStreaming`** 时传入该回调，否则 **`undefined`**（不显示停止按钮）。

**`ChatEntry`（已登录时）**

- **`input` / `setInput`**：受控或非受控由 props 决定（见 §8.0）。
- **`className="w-full pl-0.5 pr-0.5 pb-4.5 border-theme/10"`**，**`textareaClassName="min-h-9"`**。
- **`placeholder`**：`editorHasBody` 为真时「请输入您的问题」，否则「请先在左侧编辑器输入正文后再向我提问」。
- **`disableTextInput={!editorHasBody}`**。
- **`loading={isSending || isHistoryLoading}`**（流式中 **`isSending`** 在 store 里与首轮请求绑定，停止后会清）。

快捷卡片与 **`extraUserContentForModel`** 的后端契约见 **§13**。

### 8.5 流式结束后的快捷条（跟在消息流末尾 + 贴底滚动）

#### 8.5.1 产品语义

- **与 §8.4 区分**：§8.4 是 **空会话**（无气泡）时的首屏大卡片；本节是 **已有对话** 且 **当前轮发送与流式均已结束** 时，在 **最新消息气泡之后**、仍在 **`ScrollArea` 可滚动内容内** 展示的一排与 **`KNOWLEDGE_ASSISTANT_PROMPTS` 同源** 的快捷入口（再次调用 `sendKnowledgePromptCard`）。
- **不固定在输入框上方**：条带作为消息列的「尾部块」，随长对话一起滚动；用户上滑阅读历史时，条带在列表底部而非盖住输入区。
- **出现后视口贴底**：条带挂载会使 `scrollHeight` 增大；若不在布局后把视口滚到底，用户可能仍停留在旧 `scrollTop`，看不到新按钮。因此需在 **`showPostStreamActions` 变为 `true`** 时主动 **`flushScrollToBottom`**，并用 **`requestAnimationFrame` 再执行一次**，缓解 Radix `ScrollArea` 内层高度晚一帧才稳定的情况。

#### 8.5.2 显示条件（`showPostStreamActions`）

须 **同时** 满足：

| 条件                  | 含义                                          |
| --------------------- | --------------------------------------------- |
| `isLoggedIn`          | 已登录                                        |
| `messages.length > 0` | 已进入对话列表                                |
| `editorHasBody`       | 左侧编辑器有正文，润色/总结才有文档可带给模型 |
| `!isHistoryLoading`   | 不在拉取历史                                  |
| `!isSending`          | 不在发送请求生命周期内（含等待首包）          |
| `!isStreaming`        | 无助手气泡处于流式中                          |

流式或发送中为 `false`，条带卸载，避免与进行中回复抢交互。

#### 8.5.3 实现要点（逐条）

1. 从 **`useStickToBottomScroll`** 解构 **`flushScrollToBottom`**，与既有 `enableStreamStickToBottom` 并存。
2. 定义布尔 **`showPostStreamActions`**（上表条件合成），供 JSX 与 `useLayoutEffect` 共用。
3. **`useLayoutEffect`** 依赖 **`[showPostStreamActions, flushScrollToBottom]`**：当 `showPostStreamActions === true` 时调用 **`flushScrollToBottom()`**，并在 **`requestAnimationFrame`** 内再调用一次；`false` 时不做事。
4. **渲染位置**：在 **`ScrollArea`** 内、`messages.map(...)` **之后**，与气泡同一 **`max-w-3xl mx-auto`** 列容器内；条带内 **`KNOWLEDGE_ASSISTANT_PROMPTS.map`** 渲染按钮（与首屏卡片同源 `kind` / 标题，避免文案分叉）。
5. **与流式跟底的关系**：流式阶段仍由 `useStickToBottomScroll` 根据 `isStreaming` / `contentRevision` 跟底；条带仅在 idle 出现，**贴底由本节 `useLayoutEffect` 补偿**，二者职责不重复。

#### 8.5.4 代码摘录（含源码注释）

```tsx
// 文件：apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx（节选；与源码一致）

const {
	viewportRef: scrollViewportRef,
	scrollViewportHandlers,
	enableStickToBottom: enableStreamStickToBottom,
	disableStickToBottom: disableStreamStickToBottom,
	flushScrollToBottom,
} = useStickToBottomScroll({
	isStreaming: assistantStore.isStreaming,
	contentRevision: streamScrollTick,
	resetKey: documentKey || undefined,
});

/** 流式/发送结束后展示「重新总结/润色」条带（跟在消息后，见下方 ScrollArea 内渲染） */
const showPostStreamActions =
	isLoggedIn &&
	messages.length > 0 &&
	editorHasBody &&
	!assistantStore.isHistoryLoading &&
	!assistantStore.isSending &&
	!assistantStore.isStreaming;

// 条带插入后 scrollHeight 变化，须在布局后贴底，否则用户仍停在旧滚动位置
useLayoutEffect(() => {
	if (!showPostStreamActions) return;
	flushScrollToBottom();
	requestAnimationFrame(() => flushScrollToBottom());
}, [showPostStreamActions, flushScrollToBottom]);
```

```tsx
// 同一文件：ScrollArea 内消息列表末尾（节选）
{
	messages.map((message, index) => (
		<KnowledgeAssistantMessageBubble key={message.chatId} /* ... */ />
	));
}
{
	showPostStreamActions ? (
		<div className="flex w-full min-w-0 flex-wrap gap-3.5 mb-3">
			{KNOWLEDGE_ASSISTANT_PROMPTS.map((item) => (
				<Button
					key={item.kind}
					variant="dynamic"
					className="w-fit rounded-md border border-theme/10 bg-theme/5 p-2 text-left text-sm text-textcolor/80 transition-colors hover:border-theme/20 hover:text-textcolor"
					onClick={() => void sendKnowledgePromptCard(item.kind)}
				>
					{item.title}
				</Button>
			))}
		</div>
	) : null;
}
```

#### 8.5.5 Hook 侧：`flushScrollToBottom` 语义（摘录）

```typescript
// 文件：apps/frontend/src/hooks/useStickToBottomScroll.ts（节选 + 接口注释）
/** 单次滚到物理底部，不修改是否跟底的内部状态 */
flushScrollToBottom: () => void;

const flushScrollToBottom = useCallback(() => {
	const vp = viewportRef.current;
	if (!vp) return;
	vp.scrollTop = vp.scrollHeight;
}, []);
```

### 8.6 右下角滚动角标按钮：置底 / 置顶（与 Monaco 预览一致）

本节说明 `KnowledgeAssistant.tsx` 的**滚动角标按钮**（右下角、输入框上方、与输入框右边对齐）的完整实现思路与关键代码。该按钮的“何时显示、显示置顶还是置底、阈值判定”等逻辑**刻意与** `apps/frontend/src/components/design/Monaco/preview.tsx` 的预览角标保持一致，避免出现两套不一致的滚动体验。

#### 8.6.1 设计目标与约束

核心目标：

- **体验一致**：判定逻辑、阈值、模式切换与 `preview.tsx` 一致（`hidden / toBottom / toTop` 三态）。
- **不影响流式贴底**：`KnowledgeAssistant` 的消息列表在流式输出（streaming，流式输出）时由 `useStickToBottomScroll` 负责自动滚动到底部；角标按钮只能“提示/跳转”，不能破坏 hook 的跟底状态机。
- **可中断可恢复**：用户手动向上滚动应当丝滑且能打断贴底；当用户回到底部（或点击“置底”）时，应当能恢复自动贴底；当流式进行中点击“置顶”时必须真的能留在顶部（不能被立刻拉回底部）。

#### 8.6.2 为什么“置顶”要先 disableStickToBottom

`useStickToBottomScroll` 在 `isStreaming === true` 且内部 `stickToBottomRef.current === true` 时，会在 `contentRevision` 变化（新 token 到来）后**强制把视口滚到底部**（详见 `useLayoutEffect([...contentRevision])`）。

因此：

- 若流式阶段用户点击“置顶”但不先 `disableStickToBottom()`，下一次 SSE chunk 到来就会把视口拉回底部，导致“流式时无法置顶”。
- 解决方式是在 `toTop` 分支里**先** `disableStickToBottom()` 再 `scrollTo({ top: 0 })`。

#### 8.6.3 与 Monaco 预览一致的判定逻辑（参考）

`preview.tsx` 中角标按钮的核心判定如下（节选）：

```tsx
// 文件：apps/frontend/src/components/design/Monaco/preview.tsx（节选）
// 语义：内容不可滚动 -> hidden；接近底部 -> toTop；否则 -> toBottom
const refreshPreviewScrollFab = useCallback(() => {
	if (!showPreviewScrollCornerFab) {
		setPreviewScrollFabMode("hidden");
		return;
	}
	const vp = localViewportRef.current;
	if (!vp) return;
	const { scrollTop, scrollHeight, clientHeight } = vp;
	const maxScroll = scrollHeight - clientHeight;
	if (maxScroll <= 4) {
		setPreviewScrollFabMode("hidden");
		return;
	}
	const threshold = 8;
	setPreviewScrollFabMode(
		scrollTop >= maxScroll - threshold ? "toTop" : "toBottom",
	);
}, [showPreviewScrollCornerFab]);
```

#### 8.6.4 `KnowledgeAssistant.tsx` 的完整实现思路（逐条）

实现步骤（与源码一致）：

1. **引入三态 mode**：`hidden | toBottom | toTop`，与 `preview.tsx` 对齐。
2. **计算 mode 的 refresh 函数**：取 `ScrollArea` 的 viewport（`scrollViewportRef.current`），用 `maxScroll <= 4` 与 `threshold = 8` 计算 `nextMode`。
3. **降低滚动抖动**：`onScroll` 高频触发时，如果每次都 `setState` 会导致重新渲染影响滚动手感；因此用 `scrollCornerFabModeRef` 记住上一次 mode，仅当 mode 变化时才 `setScrollCornerFabMode(nextMode)`。
4. **刷新时机**：
   - **滚动时**：在 **`scrollViewportHandlers.onScroll`** 之后依次 **`relayoutCodeToolbar()`**（`useChatCodeFloatingToolbar` 返回）与 **`refreshScrollCornerFab()`**（与 hook 同一滚动事件源，见 §8.3）。
   - **内容/尺寸变化时**：`streamScrollTick / documentKey / messages.length` 变化会改变高度；通过 **`setTimeout(0) + requestAnimationFrame`** 与 **`ResizeObserver.observe(viewport)`** 触发 refresh（与 `preview.tsx` 的“正文变化/视口变化刷新”策略一致）。
5. **点击行为**：
   - `toBottom`：先 `enableStickToBottom()` 再 smooth 滚到底部，确保“回到底部后能恢复流式贴底”。
   - `toTop`：先 `disableStickToBottom()` 再 smooth 滚到顶部，确保“流式进行中也能置顶并停住”。
6. **按钮位置与图标（与当前源码一致）**：角标渲染在 **已登录** 时包裹 **`ChatEntry`** 的外层 **`div.relative.w-full.flex...pr-4.pl-3.5`** 内；条件为 **`messages.length > 0 && scrollCornerFabMode !== 'hidden'`**。按钮 **`type="button"`**，**`absolute bottom-full mb-5 right-4.5 z-10`**，**`h-8.5 w-8.5`**，**`cursor-pointer`**，**`text-textcolor/70`**，圆角描边与 **`backdrop-blur-[2px]`** 与源码一致。**`toBottom`** 分支使用 **`ChevronDown`**，**`toTop`** 使用 **`ChevronUp`**（来自 **`lucide-react`**，非 `ArrowDown`/`ArrowUp`）。**`aria-label`**：`toBottom` →「滚动到底部」，否则「滚动到顶部」。

#### 8.6.5 与源码对齐的实现清单（避免文档内大段重复漂移）

下列行为以 **`KnowledgeAssistant.tsx`** 为准，维护时 **直接读源文件** 单文件即可：

- **三态类型**：`KnowledgeAssistantScrollCornerFabMode = 'hidden' | 'toBottom' | 'toTop'`。
- **`refreshScrollCornerFab`**：`maxScroll <= 4` → `hidden`；否则 **`threshold = 8`**，`scrollTop >= maxScroll - threshold` → `toTop`，否则 `toBottom`；**`scrollCornerFabModeRef` 与 state 同步**，仅 mode 变化时 `setState`。
- **`scrollAreaHandlers`**：在 **`onViewportScroll`** 之后依次 **`relayoutCodeToolbar()`**、**`refreshScrollCornerFab()`**（文档 §8.3）。
- **`useEffect`（ResizeObserver）**：依赖 **`[streamScrollTick, documentKey, messages.length, refreshScrollCornerFab, scrollViewportRef]`**，**`setTimeout(0)`** 内两次 **`refreshScrollCornerFab`** + **`rAF`**，并对 viewport **`ResizeObserver`**。
- **`onScrollCornerFabClick`**：依赖含 **`disableStreamStickToBottom`**；**`toBottom`**：**`enableStreamStickToBottom()`** 后 **`vp.scrollTo({ top: scrollHeight - clientHeight, behavior: 'smooth' })`**；**`toTop`**：**`disableStreamStickToBottom()`** 后 **`vp.scrollTo({ top: 0, behavior: 'smooth' })`**。

如需可复制的完整 TSX，请在仓库中打开 **`apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx`**（约第 262–533 行：角标 + 输入区）。

#### 8.6.6 常见问题（FAQ）

- **为什么角标阈值不用 hook 的 `resumeWithinBottomPx`（默认 48px）？**  
  角标按钮的目标是与 `preview.tsx` 的体验一致（阈值 8px、模式切换明确）；而 `useStickToBottomScroll` 的 `resumeWithinBottomPx` 负责“贴底状态机”的稳定性与容错（更宽的底部带更符合用户拖拽/触控回到底部的判断）。两者职责不同，因此阈值不强行复用同一个值。

- **为什么要用 `scrollCornerFabModeRef`？**  
  `scroll` 事件频率很高；如果每次滚动都 `setState`，会导致 React 重新渲染频繁发生，从而影响滚动的丝滑程度。`ref` 让我们只在 mode 实际变化时更新 UI，减少不必要的渲染。

### 8.7 未登录时不渲染底部助手面板（入口层 gate）

知识页（`apps/frontend/src/views/knowledge/index.tsx`）通过 **`isCloudLoggedIn = Boolean(userStore.userInfo.id)`** 在 **入口层** 对 **`bottomBarAssistantNode`** 做 gate：**未登录时传入 `undefined`**，从而：

- **UI 层面**：未登录用户 **不 mount** `KnowledgeAssistant`，不占底部助手分屏。
- **组件层面**：避免未登录仍执行 **`activateForDocument`**、持久化开关 **`useEffect`** 等副作用（组件内部仍有 **`isLoggedIn`** 分支，但入口不渲染更干净）。
- **与 Monaco 对齐**：`apps/frontend/src/components/design/Monaco/index.tsx` 使用 **`bottomBarAssistantNode`**（注释中提及的旧名 **`bottomBarCustomNode`** 已过渡）；仅在传入该 prop 时启用 **`bottomBarAssistantNodeEnabled`** 等逻辑。

```tsx
// 文件：apps/frontend/src/views/knowledge/index.tsx（节选）
bottomBarAssistantNode={
	isCloudLoggedIn ? (
		<KnowledgeAssistant
			documentKey={knowledgeAssistantDocumentKey(
				assistantArticleBinding,
				trashOpenNonce,
			)}
			input={assistantInput}
			setInput={setAssistantInput}
		/>
	) : null
}
```

---

## 9. HTTP 封装与类型

文件：`apps/frontend/src/service/index.ts`、`apps/frontend/src/service/api.ts`。

- 常量：`ASSISTANT_SESSION`、`ASSISTANT_SESSION_IMPORT_TRANSCRIPT`、`ASSISTANT_SSE`、`ASSISTANT_STOP`。
- **`AssistantSessionDetailPayload.session`** 可为 **`null`**：表示会话已在服务端删除，前端应 **删除整桶 state**（见 §6.10）。
- **`getAssistantSessionByKnowledgeArticle`**：返回类型 `... | null` 与控制器 `data: null` 对齐。

---

## 10. 关键时序与竞态

### 10.1 首次保存：必须先 flush 再 `setEditingId`

若先 `setKnowledgeEditingKnowledgeId`，`assistantPersistenceAllowed` 变 `true`，`KnowledgeAssistant` 的 `useEffect` 触发 **`activateForDocument(toKey)`**，此时 DB 尚无迁入消息 → 拉空 → **覆盖** 内存中草稿对话 → **丢失**。正确顺序见 §5.2。

### 10.2 未保存草稿的数据落点

- **DB**：无 `assistant_sessions` / `assistant_messages` 记录。
- **浏览器内存**：`assistantStore.messages`；刷新即失。
- **智谱**：经后端转发；第三方留存不在本产品契约内。

### 10.3 删除知识后的助手请求

删除后主表会话已物理删除；前端可能仍 **`getAssistantSessionDetail`** 或 **`stopAssistantStream`**。后端 **不 404**（§4.5），前端在 **`fetchSessionMessagesForDocumentKey`** 中若见 **`payload.session == null`**，会 **`delete sessionByDocument[canonical]`** 且 **`delete stateByDocument[canonical]`**（整桶移除，见 §6.10）。

---

## 11. 工程细节与约束

1. **DTO 数组上限**：后端 `contextTurns` 120、`import lines` 200；前端迁入用 **`lines.slice(-200)`**（最近 200 条，升序），与之一致。
2. **路由顺序**：`import-transcript`、`for-knowledge` 须在 `session/:id` 之前（§4.1）。
3. **MobX**：流式更新用 **替换数组元素** 而非原地 `push` delta 到不可观察结构。
4. **TS4094**：助手 store 的 **模块级纯函数** 放类外（§6.5）；对外导出 **`AssistantStoreApi`** 接口 + **`assistantStore` 实例** 的显式标注（§6.1），避免 `useStore()` 推断类型带入 **private** 成员。
5. **鉴权**：助手全路由 `JwtGuard`；SSE 未登录返回 `{ error: '未登录', done: true }`。

---

## 12. 文件索引

| 角色                    | 路径                                                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 前端 Store              | `apps/frontend/src/store/assistant.ts`                                                                                                                                                                                         |
| 前端 SSE                | `apps/frontend/src/utils/assistantSse.ts`                                                                                                                                                                                      |
| 前端助手 UI             | `apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx`                                                                                                                                                                     |
| 前端知识页              | `apps/frontend/src/views/knowledge/index.tsx`                                                                                                                                                                                  |
| 前端常量                | `apps/frontend/src/views/knowledge/constants.ts`（`KNOWLEDGE_ASSISTANT_PROMPTS`、`KnowledgeAssistantPromptKind`、本地目录常量等）                                                                                                  |
| 前端助手工具            | `apps/frontend/src/views/knowledge/utils.ts`（`isKnowledgeLocalMarkdownId`、`knowledgeAssistantArticleBinding`、`knowledgeAssistantDocumentKey`、`buildKnowledgeAssistantDocumentMessage`）                                        |
| 前端 API                | `apps/frontend/src/service/index.ts`、`apps/frontend/src/service/api.ts`                                                                                                                                                       |
| 后端控制器              | `apps/backend/src/services/assistant/assistant.controller.ts`                                                                                                                                                                  |
| 后端服务                | `apps/backend/src/services/assistant/assistant.service.ts`                                                                                                                                                                     |
| 后端实体                | `apps/backend/src/services/assistant/assistant-session.entity.ts`、`assistant-message.entity.ts`                                                                                                                               |
| 后端 DTO                | `apps/backend/src/services/assistant/dto/*.ts`                                                                                                                                                                                 |
| 知识删除联动            | `apps/backend/src/services/knowledge/knowledge.service.ts`                                                                                                                                                                     |
| 专题摘要（持久化/落点） | `docs/knowledge/knowledge-assistant-ephemeral-persistence.md`                                                                                                                                                                  |

---

## 13. 快捷卡片与 extraUserContentForModel（用户短句 + 模型长上下文）

本节描述知识库助手首页 **「润色文档内容」**、**「总结文档内容」** 两条快捷入口的完整设计：**用户气泡与数据库中的 user 正文仅为短标题**；**当前 Markdown 全文与任务说明**通过可选字段 **`extraUserContentForModel`** 在 **服务端** 拼入 **发给智谱的最后一条 user 消息** 中，**不单独落库、不增加 `assistant_messages` 列**。

### 13.1 需求拆解（逐条）

1. **展示与持久化一致**：用户看到的 user 气泡正文 = `Message.content` = 写入 `assistant_messages.content` 的字符串 = **`润色文档内容` 或 `总结文档内容`**（无整篇文档）。
2. **模型可见全文**：智谱 `chat/completions` 的 `messages` 数组中，对应轮次的 **user** `content` 必须为 **短标题 + 换行 + 指令与文档围栏**（由后端拼接），否则模型无法润色/总结。
3. **不传 extra 时行为不变**：普通键盘发送仅带 `content`；后端 **不** 做额外拼接（见 §13.4）。
4. **Ephemeral 与持久化两条路径都要支持**：未保存草稿走 `buildEphemeralTurns`；已保存条目走「先 `insertUserAndAssistantPlaceholder` 写短 user → 再 `buildTurnsForContext` + 合并 extra → `takeRecentMessagesWithinTokenBudget`」。
5. **持久化路径的 token 预算顺序**：必须 **先把 extra 合并进「完整多轮 turns」再截断预算**，否则会出现「先按短句算预算、再拼长文导致超出上下文」的误差（实现上先 `mergeExtraUserContentForModelIntoTurns` 再 `takeRecentMessagesWithinTokenBudget`）。
6. **Ephemeral 路径**：`buildEphemeralTurns` 已在 **单条最后 user** 上合并 `content` 与 `extra`，随后 `takeRecentMessagesWithinTokenBudget` 作用于已含长文的 `allTurns`，与持久化侧「先合并再截断」语义一致。
7. **前端不发两份 user**：`contextTurns` 仍由 **push 本轮之前** 的 `messages` 生成；本轮仅 **`content` + 可选 `extraUserContentForModel`** 进入 body（与后端「先历史再本轮 tail」一致）。
8. **`activeDocumentKey` 与草稿**：`documentKey` 为 `draft-new__trash-*` 时也必须 `activateForDocument`，否则 ephemeral 发送会因 `activeDocumentKey` 为空提示「文档未就绪」（见 `KnowledgeAssistant.tsx` 内注释）。
9. **多轮追问的局限**：历史里只存短 user 句，**不存**曾带给模型的文档；用户若后续只发「再总结一遍」而无新 extra，模型侧 **看不到** 旧文档全文——这是「不把文档写入 user 消息」的产品取舍。
10. **回归建议**：在 §附录 A 中增加：快捷卡片发轮后 DB 中 user 行仅为短标题；网络抓包/服务端日志中智谱请求体最后一条 user 含 `--- 文档 ---` 围栏。

### 13.2 后端 DTO：`AssistantChatDto`

文件：`apps/backend/src/services/assistant/dto/assistant-chat.dto.ts`。

- **`content`**：必填，用户可见/可落库的短正文（快捷卡片时为「润色文档内容」或「总结文档内容」）。
- **`extraUserContentForModel`**：可选；**仅**用于服务端拼装智谱上下文，**长度上限单独放宽**（与 `content` 的 `100_000` 区分）。

```typescript
// 文件：apps/backend/src/services/assistant/dto/assistant-chat.dto.ts（节选 + 注释）
@IsString()
@IsNotEmpty()
@MaxLength(100_000)
content: string;

/**
 * 仅拼入本轮发给模型的最后一条 user 正文之后（换行衔接），不入库、不写入历史摘要。
 * 用于知识库快捷操作：气泡与 `content` 仅短标题，长文档由该字段带给模型。
 */
@IsOptional()
@IsString()
@MaxLength(500_000)
extraUserContentForModel?: string;
```

### 13.3 后端服务：`buildEphemeralTurns` 与 `mergeExtraUserContentForModelIntoTurns`

文件：`apps/backend/src/services/assistant/assistant.service.ts`。

**Ephemeral**：在 `contextTurns` 之后追加的 **最后一条 user** 上，若有 `extraUserContentForModel` 则 `content + "\n\n" + extra`，否则仅为 `content.trim()`。

**持久化**：`insertUserAndAssistantPlaceholder(..., dto.content.trim())` 只写入短句；从库构建 `allTurns` 后调用 `mergeExtraUserContentForModelIntoTurns`：从 **末尾向前** 找到 **最近一条 `role: user`**，将 `"\n\n" + extra` 拼到其 `content` 后（仅本轮最后一条 user，通常为刚插入的那条）。

```typescript
// 文件：apps/backend/src/services/assistant/assistant.service.ts（节选 + 注释）

// 不落库多轮：先还原 contextTurns，再追加「本轮 user」；本轮 user 的正文 = 短 content 可选拼 extra
private buildEphemeralTurns(dto: AssistantChatDto): AssistantChatTurn[] {
	const turns: AssistantChatTurn[] = [];
	for (const r of dto.contextTurns ?? []) {
		if (r.role !== 'user' && r.role !== 'assistant') continue;
		turns.push({ role: r.role, content: r.content ?? '' });
	}
	const extra = dto.extraUserContentForModel?.trim();
	const tail = extra
		? `${dto.content.trim()}\n\n${extra}`
		: dto.content.trim();
	turns.push({ role: 'user', content: tail });
	return turns;
}

/** 将「仅给模型」的补充正文拼到上下文末尾最近一条 user 上（用于已按短 content 落库的场景） */
private mergeExtraUserContentForModelIntoTurns(
	turns: AssistantChatTurn[],
	extra?: string,
): AssistantChatTurn[] {
	const t = extra?.trim();
	if (!t) return turns; // 无 extra：原样返回，等价于「普通发送不做拼接」
	const out = turns.map((x) => ({ ...x }));
	for (let i = out.length - 1; i >= 0; i--) {
		if (out[i].role === 'user') {
			out[i] = {
				...out[i],
				content: `${out[i].content}\n\n${t}`,
			};
			break;
		}
	}
	return out;
}
```

**持久化流中合并与截断的位置**（节选）：

```typescript
// 文件：apps/backend/src/services/assistant/assistant.service.ts（持久化分支节选）
// 落库用户句仅为 dto.content（短标题）
const { assistantMessageId: aid } =
	await this.insertUserAndAssistantPlaceholder(
		session,
		turnId,
		dto.content.trim(),
	);

const allDb = await this.loadMessagesForSessionContext(sessionId!);
const allTurns = this.buildTurnsForContext(allDb);
// 先合并 extra，再按 token 预算截取，避免预算按短句算准后再拼长文
const allTurnsForModel = this.mergeExtraUserContentForModelIntoTurns(
	allTurns,
	dto.extraUserContentForModel,
);
const budget = this.getHistoryTurnBudgetTokens(dto);
let contextTurns = takeRecentMessagesWithinTokenBudget(
	allTurnsForModel,
	budget,
);
```

### 13.4 「是否每次发送都拼接？」

**否。** 仅当请求体携带 **`extraUserContentForModel`** 且 **`.trim()` 后非空** 时，后端才会把其拼到 **本轮** 发给模型的 user 正文之后；未传或为空字符串时，`tail` 仅为 `dto.content.trim()`，`mergeExtraUserContentForModelIntoTurns` 直接 `return turns`。

### 13.5 前端常量、工具函数：任务说明与文档围栏

- **`apps/frontend/src/views/knowledge/constants.ts`**：**`KNOWLEDGE_ASSISTANT_PROMPTS`**（`kind`：`'polish' | 'summarize'`、**`LucideIcon`**、标题、副标题）、**`KnowledgeAssistantPromptKind`** 等。
- **`apps/frontend/src/views/knowledge/utils.ts`**：**`buildKnowledgeAssistantDocumentMessage`**——返回 **`userMessageShort`**（与气泡一致）与 **`extraUserContentForModel`**（指令 + `--- 文档 ---` … `--- 文档结束 ---` 包裹的当前全文；**`documentMarkdown` 会先 `replace(/\s+$/, '')` 去尾空白**）。

```typescript
// 文件：apps/frontend/src/views/knowledge/utils.ts（节选 + 注释）

/**
 * 快捷卡片：`userMessageShort` 为气泡与落库正文；`extraUserContentForModel` 仅由后端拼进发给模型的 user 上下文，不入库。
 */
export function buildKnowledgeAssistantDocumentMessage(
	kind: KnowledgeAssistantPromptKind,
	documentMarkdown: string,
): { userMessageShort: string; extraUserContentForModel: string } {
	const doc = documentMarkdown.replace(/\s+$/, "");
	if (kind === "polish") {
		return {
			userMessageShort: "润色文档内容",
			extraUserContentForModel: `请根据以下「当前知识库文档」全文进行润色与优化：…

--- 文档 ---
${doc}
--- 文档结束 ---`,
		};
	}
	return {
		userMessageShort: "总结文档内容",
		extraUserContentForModel: `请根据以下「当前知识库文档」全文输出一份简洁的中文总结：…

--- 文档 ---
${doc}
--- 文档结束 ---`,
	};
}
```

### 13.6 前端 Store：`sendMessage` 与 SSE body

文件：`apps/frontend/src/store/assistant.ts`。

- UI **push** 的用户消息：`content: text`（短），**不**把文档塞进 `Message.content`。
- **`streamAssistantSse` body**：持久化与 ephemeral 均在存在 `extraUserContentForModel` 时 **展开写入** JSON（与 DTO 字段名一致）。

```typescript
// 文件：apps/frontend/src/store/assistant.ts（节选 + 注释）

async sendMessage(
	raw?: string,
	options?: { extraUserContentForModel?: string },
): Promise<void> {
	const text = (raw ?? '').trim();
	// ...
	const extraUserContentForModel = options?.extraUserContentForModel?.trim();

	runInAction(() => {
		this.messages.push({
			chatId: userChatId,
			role: 'user',
			content: text, // 仅短标题入 UI / 入 import-transcript 行
			timestamp: new Date(),
		});
		// ... assistant 占位
	});

	const abort = await streamAssistantSse({
		body: ephemeral
			? {
					ephemeral: true,
					content: text,
					...(extraUserContentForModel ? { extraUserContentForModel } : {}),
					contextTurns,
				}
			: {
					sessionId: sid,
					content: text,
					...(extraUserContentForModel ? { extraUserContentForModel } : {}),
				},
		// ...
	});
}
```

### 13.7 前端 UI：`KnowledgeAssistant`

文件：`apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx`。

- **`activateForDocument`**：`documentKey` 非空即调用（含 `draft-new*`），保证 **`activeDocumentKey`** 就绪。
- **`sendKnowledgePromptCard`**：校验登录、左侧有正文、非发送/加载/流式中；调用 `buildKnowledgeAssistantDocumentMessage`，再 `sendMessage(userMessageShort, { extraUserContentForModel })`。
- **首页卡片**（空会话）：`KNOWLEDGE_ASSISTANT_PROMPTS` + `button`（或 `Button` 封装，以仓库为准）；进行中时 `pointer-events-none opacity-50`。
- **流式结束后的快捷条**（有会话）、**`flushScrollToBottom` 贴底**：见 **§8.5**（与首屏卡片同源 `kind`，避免重复维护文案）。

```tsx
// 文件：apps/frontend/src/views/knowledge/KnowledgeAssistant.tsx（节选 + 注释）

// 未保存草稿的 key 也必须 activate，否则 ephemeral 下 activeDocumentKey 为空 →「文档未就绪」
useEffect(() => {
	if (!documentKey) return;
	void assistantStore.activateForDocument(documentKey);
}, [documentKey]);

/** 首页快捷卡片：用户气泡仅显示标题，请求体携带 extra（文档由后端拼进模型上下文） */
const sendKnowledgePromptCard = useCallback(
	async (kind: KnowledgeAssistantPromptKind) => {
		// ... 登录、正文、isSending / isHistoryLoading / isStreaming 校验
		const { userMessageShort, extraUserContentForModel } =
			buildKnowledgeAssistantDocumentMessage(
				kind,
				knowledgeStore.markdown ?? "",
			);
		enableStreamStickToBottom();
		await assistantStore.sendMessage(userMessageShort, {
			extraUserContentForModel,
		});
	},
	[isLoggedIn, knowledgeStore.markdown, enableStreamStickToBottom],
);
```

### 13.8 与附录 B 的关系

附录 **B.2**、**B.3** 中的部分片段为 **教学式最小示例**；**含 `extraUserContentForModel` 的完整契约与分支** 以 **本节 §13** 与仓库源码为准（下文 B.2 / B.3 已更新为与当前实现对齐的摘要）。

---

## 附录 A：回归自检清单（维护用）

- [ ] 未登录：助手区文案与禁用逻辑正确。
- [ ] 新建云端草稿：可问答、刷新后对话消失；保存后对话进库且再开可加载。
- [ ] 已保存条目：多轮、停止生成、`fetchSessionMessages` 对齐。
- [ ] 回收站预览：binding 前缀下会话隔离。
- [ ] 本地 `__local_md__`：持久化允许为 true。
- [ ] 清空草稿：助手气泡与映射清空。
- [ ] 删除当前知识：无「会话不存在」误报；助手状态可恢复。
- [ ] 另存为：与新建类似的 flush 顺序。
- [ ] 快捷卡片（润色/总结）：DB user 行仅为短标题；SSE 可选 `extraUserContentForModel` 时智谱侧 user 含文档围栏（§13）。
- [ ] 有对话且流式结束后：消息列表底部出现与 `KNOWLEDGE_ASSISTANT_PROMPTS` 同源的快捷条，且视口自动贴底（§8.5）。

---

## 附录 B：核心逻辑带读（与源码对照的中文注释）

下列片段为 **教学式重组**，行号以仓库文件为准；注释为中文，便于与 `assistant.ts` 对照阅读。

### B.1 `knowledgeArticleBindingFromDocumentKey`（解析条目标识）

```typescript
// 文件：apps/frontend/src/store/assistant.ts
// 作用：从完整 documentKey 中去掉 `__trash-{nonce}` 后缀，得到与后端 `knowledgeArticleId` 对齐的 bindingId。
// 例：`a1b2c3d4-...__trash-0` → `a1b2c3d4-...`；`draft-new__trash-1` → `draft-new`。
function knowledgeArticleBindingFromDocumentKey(documentKey: string): string {
	const sep = "__trash-";
	const i = documentKey.indexOf(sep);
	return (i >= 0 ? documentKey.slice(0, i) : documentKey).trim();
}
```

### B.2 `sendMessage` 双轨（持久化 vs ephemeral）语义

```typescript
// 文件：apps/frontend/src/store/assistant.ts — 逻辑重组说明（与当前实现一致；§13 补充 extra 字段）
async sendMessage(
	raw?: string,
	options?: { extraUserContentForModel?: string },
): Promise<void> {
	const text = (raw ?? '').trim();
	if (!text || this.isSending || this.isHistoryLoading) return;
	const extraUserContentForModel = options?.extraUserContentForModel?.trim();

	// 与 KnowledgeAssistant 同步的开关：false = 未保存云端草稿
	const ephemeral = !this.knowledgeAssistantPersistenceAllowed;

	let sid: string | null = null;
	if (!ephemeral) {
		// 持久化：确保库里有 session，后续 SSE 带 sessionId，服务端会落库占位消息
		sid = await this.ensureSessionForCurrentDocument();
		if (!sid) return;
	} else {
		// 临时：不创建 DB session；须校验登录与 activeDocumentKey（草稿也需 activate，见 §13.7）
		if (!readToken() || !this.activeDocumentKey) return;
	}

	// 关键：contextTurns 必须在「尚未 push 本轮 user/assistant」之前从 this.messages 生成，
	// 这样发给后端的 history 不含本轮；本轮 user 正文在 UI 与 push 中仅为 text（短句）。
	const contextTurns = ephemeral
		? buildEphemeralContextTurnsFromMessages(this.messages)
		: undefined;

	// push：用户气泡 content = text（短）；SSE body 同 text，并可带 extraUserContentForModel（仅服务端拼进模型）
	// ... streamAssistantSse({
	//   body: ephemeral
	//     ? { ephemeral: true, content: text, contextTurns, ...optionalExtra }
	//     : { sessionId: sid, content: text, ...optionalExtra },
	// })

	// onComplete：仅持久化路径 fetchSessionMessages，用 DB 最终态覆盖（含服务端 message id 等）
}
```

### B.3 后端 `buildEphemeralTurns`（与前端字段契约）

```typescript
// 文件：apps/backend/src/services/assistant/assistant.service.ts
// 顺序：先追加 dto.contextTurns[]（user/assistant），再追加本轮 user。
// 本轮 user 发给智谱的正文 = dto.content.trim() +（可选）"\n\n" + dto.extraUserContentForModel（§13）。
// 因此前端 contextTurns 不得包含本轮用户句；文档长文应放 extra，避免与落库短 content 混写。
private buildEphemeralTurns(dto: AssistantChatDto): AssistantChatTurn[] {
	const turns: AssistantChatTurn[] = [];
	for (const r of dto.contextTurns ?? []) {
		if (r.role !== 'user' && r.role !== 'assistant') continue;
		turns.push({ role: r.role, content: r.content ?? '' });
	}
	const extra = dto.extraUserContentForModel?.trim();
	const tail = extra
		? `${dto.content.trim()}\n\n${extra}`
		: dto.content.trim();
	turns.push({ role: 'user', content: tail });
	return turns;
}
```

### B.4 `chatStream` 入口分支（持久化 vs ephemeral）

```typescript
// 文件：apps/backend/src/services/assistant/assistant.service.ts — 语义摘要
if (dto.ephemeral === true) {
	// 禁止带 sessionId / knowledgeArticleId，避免误写库
	await this.runEphemeralChatStream(subscriber, dto);
	return;
}
// 以下：解析/创建 AssistantSession → insertUserAndAssistantPlaceholder → Redis epoch → 智谱流式 → finalize / cleanup
```

### B.5 NestJS Sse 行格式（前端解析依据）

每一行形如：`data: {"type":"content","content":"..."}\n`  
结束：`data: {"done":true}\n`（控制器在流末尾 concat 的 `done$`）。  
错误：`data: {"error":"...","done":true}` 或由 `catchError` 注入的 `error` 字段。
