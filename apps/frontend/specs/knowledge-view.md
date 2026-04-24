# 知识库编辑视图（`/knowledge`）SPEC（由实现反推）

> **范围**：`apps/frontend/src/views/knowledge/**` 与其实际依赖的 `knowledgeStore`、HTTP service、Tauri invoke、右侧 `KnowledgeAssistant`、`MarkdownEditor`（Monaco）在本页传入的契约。  
> **非目标**：不展开 `assistantStore` 全量实现；会话迁移/落库细节以 `docs/knowledge/knowledge-assistant-complete.md` 为准，本 SPEC 只写知识页如何调用与约束。  
> **依据**：以当前仓库代码为准；HTTP 路径以 `apps/frontend/src/service/index.ts` 注释为准。

---

### 1. 目标与范围

#### 1.1 目标

- 提供 **Markdown（Markdown，轻量标记语言）** 为主的本地编辑体验：标题 + 正文草稿常驻 `knowledgeStore`（离开 `/knowledge` 路由不丢）。
- 在 **已登录** 且 `userStore.userInfo.id` 有效时，支持 **云端知识库 CRUD（增删改查）**：列表分页、详情载入、保存（新建/更新）、删除、回收站列表/详情/彻底删除（含批量）。
- 在 **Tauri（桌面壳）** 运行时，额外支持 **本地 `.md` 文件** 的目录浏览、读写、删除，及与云端条目并存时的删除分流。
- 在 **已登录** 时，编辑器底部嵌入 **知识库助手（Knowledge Assistant）**：与左侧文档 `documentKey` 绑定，支持把助手回复 **追加** 到当前知识文档。

#### 1.2 范围（包含）

- 路由：`/knowledge` → `apps/frontend/src/views/knowledge/index.tsx`（默认导出 `Knowledge`）。
- 子组件：`KnowledgeList`、`KnowledgeTrashList`、`KnowledgeEditorToolbar`、`KnowledgeAssistant`；常量与纯函数：`constants.ts`、`utils.ts`。
- 状态：`apps/frontend/src/store/knowledge.ts`（单例 `knowledgeStore`）。
- 网络：`saveKnowledge` / `getKnowledgeList` / `getKnowledgeDetail` / `updateKnowledge` / `deleteKnowledge` / `getKnowledgeTrashList` / `getKnowledgeTrashDetail` / `deleteKnowledgeTrash` / `deleteKnowledgeTrashBatch`（定义于 `apps/frontend/src/service/index.ts`）。
- 桌面端：`@/utils/knowledge-save` 中的 Tauri `invoke` 封装（保存/解析目标/列举/读文件/删文件/外部编辑器打开等）。

#### 1.3 非目标（明确不做）

- 不定义后端 DTO 的演进历史；仅描述前端调用形态与字段。
- 不把 Monaco 内部所有视图状态机完整展开；仅描述 **本页传入 props** 触发的行为与与本页相关的快捷键分层。

---

### 2. 目录结构与关键入口

#### 2.1 路由入口

- **路径**：`/knowledge`（见 `apps/frontend/src/router/routes.ts`）。
- **页面组件**：`apps/frontend/src/views/knowledge/index.tsx` 默认导出 `Knowledge`（`mobx-react` 的 `observer`）。

#### 2.2 视图内文件职责

| 文件 | 职责 |
| --- | --- |
| `index.tsx` | 主编排：Monaco 编辑器、保存/覆盖/另存为、自动保存、全局快捷键、回收站/列表抽屉、与 `assistantStore` 的会话 key 迁移协同。 |
| `KnowledgeEditorToolbar.tsx` | 顶栏按钮：保存、清空、打开知识库抽屉、打开回收站抽屉；展示快捷键 Tooltip。 |
| `KnowledgeList.tsx` | 知识库抽屉：云端分页列表 **或** Tauri 本地目录扫描列表；打开详情、删除分流、外部编辑器打开。 |
| `KnowledgeTrashList.tsx` | 回收站抽屉：分页列表、详情拉取、单行/批量彻底删除。 |
| `KnowledgeAssistant.tsx` | 底部助手区：`documentKey` 驱动的激活、持久化策略、快捷卡片发消息、消息区滚动与代码块浮动条。 |
| `constants.ts` | `TAURI_KNOWLEDGE_DIR`、`KNOWLEDGE_LOCAL_MD_ID_PREFIX`、`EDITOR_HEIGHT`、助手首页卡片配置。 |
| `utils.ts` | `documentKey` / `articleBinding` 拼接规则；助手快捷卡片请求体构造。 |

#### 2.3 关键依赖（跨模块）

- **`knowledgeStore`**：`markdown`、`knowledgeTitle`、`knowledgeEditingKnowledgeId`、`knowledgeTrashPreviewId`、本地路径/磁盘标题、持久化快照、覆盖保存弹窗状态、列表/回收站分页与滚动加载。
- **`userStore`**：`userInfo.id` 作为 **是否可调用云端知识库 API** 的门闩（`0` 视为未登录态的一种实现细节）。
- **`assistantStore`**：`activateForDocument`、`setKnowledgeAssistantPersistenceAllowed`、`sendMessage`、`flushEphemeralTranscriptIfNeeded`、`scheduleEphemeralFlushAfterStreaming`、`remapAssistantSessionDocumentKey`、`clearAssistantStateOnKnowledgeDraftReset` 等（调用点以 `index.tsx` / `KnowledgeAssistant.tsx` 为准）。
- **`MarkdownEditor`（`@/components/design/Monaco`）**：本页以 props 约定 Diff 基线、换篇 identity、助手面板受控、从编辑器同步最新 markdown 等。

---

### 3. 核心概念与术语

#### 3.1 标识符

- **`knowledgeEditingKnowledgeId`**：当前编辑绑定的云端知识 id；`null` 表示「新草稿」。
- **`knowledgeTrashPreviewId`**：从回收站打开预览时，记录 **回收站行 id**（不是 `originalId`）；用于让助手会话与「预览中的已删条目」隔离。
- **`assistantArticleBinding`**：助手绑定前缀，规则见 `knowledgeAssistantArticleBinding`（`utils.ts`）：回收站预览优先，否则为 `knowledgeEditingKnowledgeId` 或字面量 `draft-new`。
- **`trashOpenNonce`**：每次从回收站 `pick` 时自增，拼入 `documentKey` / `documentIdentity`，用于解决「多条预览都落在 `draft-new`」导致的 Monaco 内部状态（例如 `splitDiff`）不重置问题（见 `index.tsx` 注释）。
- **`clearDocumentNonce`**：清空草稿时自增，仅拼入 `MarkdownEditor` 的 `documentIdentity`，与 `trashOpenNonce` 解耦，避免清空时误重置助手会话（见 `index.tsx` 注释）。
- **`KNOWLEDGE_LOCAL_MD_ID_PREFIX`（`__local_md__:`）**：本地文件夹打开的条目 id 前缀；此类 id **不走云端保存/更新**（`persistKnowledgeApi` 早退）。

#### 3.2 脏检查与快照

- **`knowledgePersistedSnapshot`**：由「上次成功保存」或「从列表/回收站打开时」写入；脏点判断为：  
  `trim(knowledgeTitle) !== snap.title || markdown !== snap.content`（见 `index.tsx`）。

#### 3.3 Monaco 语言（language）

- 由 `monacoLanguageFromKnowledgeTitle(knowledgeTitle)` 决定（`@/utils/knowledge-save`）：根据标题后缀选择 `markdown` / `typescript` / `css` 等；无扩展名则默认 `markdown`。

#### 3.4 桌面端目录常量

- `TAURI_KNOWLEDGE_DIR`：写死在 `views/knowledge/constants.ts`（当前值为绝对路径字符串）。**验收注意**：这是部署/开发机路径约束，换环境需同步修改或改为配置化（否则本地默认目录不一致）。

---

### 4. 用户可见功能点（按用户动作拆分）

#### 4.1 编辑标题与正文（脏提示、最大长度）

- **触发入口**：标题 `Input`；Monaco 编辑区（受控 `value={knowledgeStore.markdown}`）。
- **前置条件**：无硬门禁；未登录也可编辑（但保存策略见 4.6）。
- **状态变化**：
  - 标题：`knowledgeStore.setKnowledgeTitle`。
  - 正文：`handleMarkdownChange` → `knowledgeStore.setMarkdown`。
- **网络调用**：无。
- **UI 表现**：
  - 标题旁 `NotebookPen`：存在未保存修改时显示橙色小圆点（`hasUnsavedChanges`）。
  - 标题 `maxLength={100}`。
- **错误处理与回滚**：无。
- **边界条件**：
  - 脏检查比较的是 **trim 后标题** 与 **原始 markdown**（不 trim 正文）。

#### 4.2 打开「知识库」抽屉：云端列表 / 本地文件夹列表

- **触发入口**：工具栏「知识库」按钮；快捷键 `openLibrary`（在 `window` `capture` 阶段监听，见 `index.tsx`）。
- **前置条件**：
  - 云端列表：`allowCloudList === true`（本页传入 `isCloudLoggedIn`，即 `Boolean(userStore.userInfo.id)`）。
  - 本地列表：仅 `isTauriRuntime()` 为真时可用；浏览器环境 UI 会提示不可用（见 `KnowledgeList.tsx`）。
- **状态变化**：
  - 打开抽屉：`listOpen` local state。
  - `KnowledgeList` 内部：`useLocalFolder` 默认 `!allowCloudList`（未登录强制本地模式）。
- **网络调用**：
  - 云端：`knowledgeStore.refreshList()` → `getKnowledgeList`（`GET /knowledge/list`），分页参数 `pageNo/pageSize/title/authorId`（见 `knowledgeStore.fetchPage`）。
  - 本地：`invokeListKnowledgeMarkdownFiles`（动态 import `@tauri-apps/api/core`）。
- **UI 表现**：
  - 列表行 hover 才显示删除按钮（避免 `focus-within` 导致抽屉打开时常显删除）。
  - 本地模式额外显示「在 Cursor 或 Trae 中打开」。
- **错误处理与回滚**：
  - 本地列表失败：`Toast` 错误并清空 `localList`。
  - 读文件失败：`Toast` 错误，不关闭抽屉。
- **边界条件**：
  - 未登录：云端开关禁用且 `useEffect` 强制 `useLocalFolder=true`，避免误请求云端列表。
  - 云端行点击：若 `userStore.userInfo.id` 为假，直接 `Toast`「请先登录」并中止 `fetchDetail`。
  - 滚动触底：`ScrollArea` `onScroll` 绑定 `knowledgeStore.onListViewportScroll` 触发 `loadMore()`（阈值 `SCROLL_LOAD_THRESHOLD_PX = 72`）。

#### 4.3 从知识库列表打开一条（云端详情 / 本地读盘）

- **触发入口**：点击列表行（键盘 `Enter`/`Space` 亦可激活行）。
- **前置条件**：云端需要登录 id；本地需要 `localAbsolutePath`。
- **状态变化（云端 `onPick` → `handlePickRecord`）**：
  - 关闭覆盖弹窗：`setKnowledgeOverwriteOpen(false)`。
  - 绑定编辑 id：`setKnowledgeEditingKnowledgeId(record.id)`。
  - 本地目录：`setKnowledgeLocalDirPath(record.localDirPath ?? null)`。
  - 磁盘标题：`setKnowledgeLocalDiskTitle(trim(title)||null)`。
  - 快照：`setKnowledgePersistedSnapshot({ title: trim, content })`。
  - 草稿：`setKnowledgeTitle`、`setMarkdown`。
- **状态变化（本地文件 `onPick`）**：
  - `id` 为 `__local_md__:${encodeURIComponent(path)}`；`localDirPath` 为 `dirnameFs(path)`。
- **网络调用**：
  - 云端：`knowledgeStore.fetchDetail` → `getKnowledgeDetail`（`GET /knowledge/detail/:id`）。
  - 本地：`invokeReadKnowledgeMarkdownFile(path)`。
- **UI 表现**：成功后关闭抽屉（`onOpenChange(false)`）。
- **错误处理与回滚**：失败 `Toast`，保持抽屉打开状态（本地读盘失败时）。
- **边界条件**：
  - 从列表打开正式条目会 `setKnowledgeEditingKnowledgeId` → `knowledgeStore` 同步清空 `knowledgeTrashPreviewId`（避免助手仍绑定回收站预览态）。

#### 4.4 删除知识库条目（云端 / 本地 / 双端分流）

- **触发入口**：列表行删除图标。
- **前置条件**：云端删除需要登录 id。
- **状态变化**：删除成功后 `knowledgeStore.removeFromLocalList`；若删除的是当前编辑条目，父组件 `resetEditorToNewDraft()`；若登录则 `refreshList()`。
- **网络调用**：
  - 云端记录：`deleteKnowledge`（`DELETE /knowledge/delete/:id`）。
  - 本地文件：`invokeDeleteKnowledgeMarkdown`（标题 + `filePath/dirPath` 规则见 `knowledge-save.ts`）。
- **UI 表现**：多阶段 `Confirm` 文案区分：
  - 浏览器：通常走「仅删数据库」确认。
  - Tauri + 云端条目且解析到本地存在：三动作（同时删除 / 本地删除 / 在线删除）。
  - 本地文件夹浏览模式：仅删除磁盘文件。
- **错误处理与回滚**：每一步失败 `Toast`；本地文件夹删除成功会 `loadLocalMarkdownList()` 刷新。
- **边界条件**：
  - 「仅删在线」成功后对话框关闭，但本地文件仍在（符合文案）。
  - 「先删在线再删本地」若本地删除失败：在线已删，本地失败 `Toast`（实现如此，验收需接受中间态）。

#### 4.5 打开「回收站」抽屉：列表、预览入编辑器、彻底删除

- **触发入口**：工具栏「回收站」；快捷键 `openTrash`（未登录直接 return，不拦截事件）。
- **前置条件**：父组件仅在 `isCloudLoggedIn` 时渲染 `KnowledgeTrashList`；未登录时工具栏也不展示回收站入口。
- **状态变化**：
  - 打开抽屉：`refreshTrashList()`；清空多选 `selection`。
  - 行点击：`handlePickTrashRecord`：`trashOpenNonce++`；`knowledgeEditingKnowledgeId=null`；`knowledgeTrashPreviewId=trashItemId`；快照/标题/正文回填。
- **网络调用**：
  - 列表：`getKnowledgeTrashList`（`GET /knowledge/trash/list`）。
  - 详情：`getKnowledgeTrashDetail`（`GET /knowledge/trash/detail/:id`）。
  - 删除：`deleteKnowledgeTrash` / `deleteKnowledgeTrashBatch`。
- **UI 表现**：
  - 当前预览行高亮：`knowledgeStore.knowledgeTrashPreviewId === item.id`。
  - 批量删除：`POST /knowledge/trash/delete-batch`，成功提示 `affected`。
  - 删除后会 `refreshTrashList()` 以对齐 total/分页边界（见 `KnowledgeTrashList.tsx` 注释）。
- **错误处理与回滚**：详情/删除失败 `Toast`。
- **边界条件**：
  - 预览打开后保存：由于 `editingKnowledgeId` 为空，保存走 **新建云端**（见 `persistKnowledgeApi` 分支）。

#### 4.6 手动保存（工具栏/快捷键）与「未登录浏览器不可保存」

- **触发入口**：工具栏保存；快捷键 `save`（`capture` 阶段，`saveLoading` 或覆盖弹窗打开时直接 return）。
- **前置条件**：
  - `trim(title)` 非空；`markdown` 非空（`performSave('normal')` 下否则 `Toast`）。
  - 若 **非 Tauri** 且 **未登录**：`Toast` 警告并中止（避免只更新快照造成“已保存假象”，见 `performSave` 注释）。
  - 若标题/正文相对 `knowledgePersistedSnapshot` 无变化：直接 return（不弹成功）。
- **状态变化**：保存过程 `saveLoading`；成功后 `syncSnapshotAfterPersist` + `setKnowledgeLocalDiskTitle(trimmedTitle)`。
- **网络调用**：
  - 云端：`persistKnowledgeApi`：
    - 本地 md id：直接 `return`（不写库）。
    - 未登录：`return`（不写库）。
    - 有 `editingId`：`updateKnowledge`（`PUT /knowledge/update/:id`，body 含 `id`）。
    - 无 `editingId`：`saveKnowledge`（`POST /knowledge/save`）并在成功拿到 `id` 后执行助手会话迁移（见 4.10）。
- **Tauri 本地写入**：在 `isTauriRuntime()` 时构造 `SaveKnowledgeMarkdownPayload`：
  - `filePath`：本地条目用 `knowledgeLocalDirPath`（空则 `TAURI_KNOWLEDGE_DIR`）；云端条目固定 `TAURI_KNOWLEDGE_DIR`。
  - `previousTitle`：当「有 editingId 且磁盘记录标题与当前 trim 标题不同」时传入，用于重命名本地文件避免残留。
  - 冲突：调用 `invokeResolveKnowledgeMarkdownTarget`；若存在且未开启覆盖保存：`openKnowledgeOverwriteConfirm`（弹窗三动作：覆盖/另存为/取消）。
- **UI 表现**：成功 `Toast`；失败 `Toast` 或 `throw`（更新失败会 `throw` 以中断 finally 之外的流程）。
- **错误处理与回滚**：
  - `performSave` 用 `try/finally` 复位 `saveLoading`。
  - 覆盖确认后的保存见 4.7。
- **边界条件**：
  - 保存前强制 `getMarkdownFromEditorRef.current?.()` 同步 Monaco 文本，规避父级 `onChange` rAF 合并导致脏检查误判（见 `index.tsx` 注释）。

#### 4.7 覆盖保存确认（Tauri 同名文件冲突）

- **触发入口**：`performSave('normal')` 检测到 `target.exists && !knowledgeOverwriteSaveEnabled`。
- **前置条件**：`knowledgePendingSavePayload` 非空。
- **状态变化**：`knowledgeStore.openKnowledgeOverwriteConfirm(path, payload)`。
- **网络调用**：
  - 「覆盖保存」：`onConfirmOverwrite`：`persistKnowledgeApi()` 后 `invokeSaveKnowledgeMarkdown({...pending, overwrite:true})`。
  - 「另存为」：`onSaveAsFromOverwrite`（见 4.8）。
- **UI 表现**：`Confirm`：`closeOnConfirm={false}`；`confirmOnEnter`；展示完整路径。
- **错误处理与回滚**：异常 `Toast(formatTauriInvokeError)`；失败不自动关弹窗（由 `closeOnConfirm` 控制）。
- **边界条件**：
  - 若快照已等于当前：提示「暂无修改」并关弹窗（避免空写）。

#### 4.8 另存为（覆盖弹窗内 / `pickNonConflictingDiskFileTitle`）

- **触发入口**：覆盖弹窗 secondary「另存为」。
- **前置条件**：`pending` payload 存在。
- **状态变化**：
  - 先关覆盖弹窗并移除 `previousTitle` 字段（避免把重命名语义带到新文件）。
  - 若已登录：调用 `persistKnowledgeApiSaveAs(displayTitle)`：**始终新建云端记录**（不更新当前 id）。
  - 成功后 `runTauriSave` 写入新磁盘标题（`diskTitle`）。
  - 若满足「`(wasLocalOnly || !isCloudLoggedIn) && tauriRes.filePath`」：把编辑中 id 切到新的 `__local_md__:` id，并 `setKnowledgeLocalDirPath(dirnameFs(filePath))`。
- **网络调用**：`saveKnowledge`（新建）+ Tauri `save_knowledge_markdown`。
- **UI 表现**：外部编辑器打开成功/失败 `Toast`（与本节无关）。
- **边界条件**：
  - `pickNonConflictingDiskFileTitle` 最多尝试 50 次冲突探测，失败抛错（`Toast`）。

#### 4.9 自动保存（依赖覆盖开关、防抖、与覆盖弹窗互斥）

- **触发入口**：`knowledgeStore.knowledgeAutoSaveEnabled` 与 `knowledgeAutoSaveIntervalSec`（由 Monaco 底部栏传入的受控开关/间隔；`knowledgeStore` 持久化到 `localStorage`）。
- **前置条件（硬约束）**：**未开启覆盖保存时**，本页 `useEffect` 强制关闭自动保存；`performSave('auto')` 也在 auto 分支对冲突静默跳过。
- **状态变化**：标题/正文/快照变化时重置 `setTimeout`；到期调用 `performSave('auto')`。
- **网络调用**：与手动保存相同，但缺标题/缺正文/浏览器未登录/冲突等更多 **静默跳过**。
- **UI 表现**：不应打断用户（实现上主要依赖 `Toast` 在 normal 模式才出现）。
- **边界条件**：
  - `waitMs = clamp(sec*1000, 5000, 3_600_000)`（与 store 的 `5..3600` 秒范围一致）。
  - `saveLoading` 或 `knowledgeOverwriteOpen` 时 timer 回调直接 return。

#### 4.10 新建保存成功后的助手会话迁移（与流式互斥）

- **触发入口**：`saveKnowledge` 成功返回 `data.id` 且当前并非 `knowledgeAssistantPersistenceAllowed`（由 `KnowledgeAssistant` 根据是否已绑定正式条目/回收站预览/本地文件计算）。
- **前置条件**：实现分支仅在 `!assistantStore.knowledgeAssistantPersistenceAllowed` 时执行（见 `index.tsx`）。
- **状态变化**：
  - 计算 `fromKey`/`toKey`（基于保存前 `articleBase` 与 `trashOpenNonce`）。
  - 若 `isStreamingForDocumentKey(fromKey)`：`scheduleEphemeralFlushAfterStreaming`；否则 `flushEphemeralTranscriptIfNeeded`。
  - `remapAssistantSessionDocumentKey(fromKey, toKey)`。
  - `setKnowledgeEditingKnowledgeId(res.data.id)`；维护 `knowledgeLocalDiskTitle`。
  - 若拿到 sessionId：`persistKnowledgeArticleBindingOnServer`（`.catch(() => {})` 吞错）。
- **网络调用**：`saveKnowledge` +（可选）助手相关 HTTP（在 `assistantStore` 内）。
- **UI 表现**：不应打断用户；流式中延迟迁移。
- **边界条件**：
  - `persistKnowledgeApiSaveAs` 也执行类似迁移逻辑（另存为产生新 id）。

#### 4.11 清空草稿（工具栏/快捷键）与助手内存态清理

- **触发入口**：工具栏清空；快捷键 `clear`。
- **前置条件**：无。
- **状态变化**：
  - `clearDocumentNonce++`（驱动 Monaco `documentIdentity`）。
  - `knowledgeStore.clearKnowledgeDraft()`：清空标题/正文/id/回收站预览/本地路径/快照/覆盖弹窗挂起状态。
  - `assistantStore.clearAssistantStateOnKnowledgeDraftReset(nextAssistantDocumentKey)`：清空不落库的 ephemeral 会话等（参数为清空后的 `documentKey`）。
- **网络调用**：无。
- **UI 表现**：脏点消失；Monaco 换篇（identity 变化）。
- **边界条件**：
  - 注释明确：**不要**用 `trashOpenNonce` 驱动清空，否则会把助手会话绑错 key。

#### 4.12 知识库助手：激活、持久化策略、发送、停止、追加到文档

- **触发入口**：Monaco 底部栏打开助手（本页 `markdownAssistantOpen` 受控）；`ChatEntry` 发送；快捷卡片按钮。
- **前置条件**：
  - 组件整体：仅 `isCloudLoggedIn` 时渲染（未登录不展示助手 UI）。
  - 发送：`userStore.userInfo.id` 为真；否则 `Toast`。
  - 快捷卡片：除登录外还要求 `markdown` trim 非空，且不能在 `isSending/isHistoryLoading/isStreaming` 时触发。
- **状态变化**：
  - `assistantPersistenceAllowed`：`trashPreview` 或「本地 md」或「已有 editingId」为真时允许落库；否则 false。
  - `useEffect` 设置 `assistantStore.setKnowledgeAssistantPersistenceAllowed`，卸载时恢复为 `true`（避免污染其它页面）。
  - `activateForDocument(documentKey)`：`documentKey` 变或编辑器有正文时触发；若 `activeDocumentKey===documentKey` 且正文空则不再 activate（避免二次清空）。
- **网络调用**：`assistantStore.sendMessage` / `stopGenerating`（具体 endpoint 不在本视图文件定义）。
- **UI 表现**：
  - 无消息：展示快捷卡片（两枚：`polish` / `summarize`）或欢迎文案（取决于左侧是否有正文）。
  - 输入框：`disableTextInput={!editorHasBody}`；placeholder 分两种。
  - 复制：使用 `navigator.clipboard.writeText` + 500ms 高亮复位。
  - 「保存到知识库」：`onSaveToKnowledge` 将助手正文 trim 后 append 到 `knowledgeStore.markdown`。
- **错误处理与回滚**：
  - 空正文：`Toast`。
  - 左侧正文被清空：200ms debounce 后才清空助手输入，规避 Monaco 重挂载瞬态（见 `KnowledgeAssistant.tsx` 注释）。
- **边界条件**：
  - `documentKey` 必须与 `MarkdownEditor` 的 `documentIdentity` 前缀一致（`knowledgeAssistantDocumentKey` + nonce 规则），否则助手与编辑器绑定会漂移。

#### 4.13 将编辑器选区送入助手输入框（快捷键分层）

- **触发入口**：Monaco 内部命令（当事件路径在 Monaco 内时放行）；本页快捷键 `pasteToAssistant` 在 **非 Monaco** 路径下 `preventDefault` 但不粘贴（避免误触）。
- **前置条件**：选区文本 trim 非空才会拼接进 `assistantInput`。
- **状态变化**：先 `getMarkdownFromEditorRef.current?.()` 强制同步 markdown，再写入输入；若助手未开：`queueMicrotask(() => setMarkdownAssistantOpen(true))`。
- **网络调用**：无。
- **UI 表现**：避免“开启助手导致重挂载瞬间把输入清空”的竞态（见 `index.tsx` 注释）。
- **边界条件**：`markdownAssistantOpen` 为依赖项，确保逻辑在面板切换时更新。

#### 4.14 Monaco：Diff 基线、换篇 identity、底部栏快捷键注入

- **触发入口**：用户切换视图模式/打开 Diff/打开助手等（Monaco 内部）；本页提供配置。
- **前置条件**：无。
- **本页传入的关键 props（契约）**：
  - `diffBaselineSource="persisted"` + `diffBaselineText={knowledgePersistedSnapshot.content}`：Diff 对照基线为「打开时快照」，不是实时编辑内容。
  - `documentIdentity`：`${knowledgeAssistantDocumentKey(...)}__clear-${clearDocumentNonce}`。
  - `markdownAssistantOpen` / `onMarkdownAssistantOpenChange`：**受控**助手开关（因此 `MarkdownEditor` 在 `documentIdentity` 变化时 **不会**自动走内部关助手逻辑，需本页自行承担一致性）。
  - `getMarkdownFromEditorRef`：供父组件命令式读取编辑器最新文本。
  - `shortcutSource`：注入默认和弦 + `loadKnowledgeShortcutChords` + 订阅 `KNOWLEDGE_SHORTCUTS_CHANGED_EVENT`。
  - `stickyScrollEnabled={false}`：知识页关闭粘性滚动（产品决策）。
- **状态变化（Monaco 内部，与本页相关）**：
  - `documentIdentity` 变化会强制退出 `splitDiff` 进入 `edit`（`Monaco/index.tsx`）。
- **网络调用**：无。
- **UI 表现**：高度 `EDITOR_HEIGHT`（`calc(100vh - 172px)`）。
- **边界条件**：
  - 进入 `splitDiff` 前 Monaco 会 `closeMarkdownAssistant()`（内部逻辑）；若父级仍保持 `markdownAssistantOpen=true`，可能出现「viewMode=edit 但父级仍认为助手打开」的短暂不一致，需要人工验收确认是否影响布局（潜在风险点）。

---

### 5. 状态模型与数据结构

#### 5.1 `knowledgeStore` 字段分组（与视图强相关）

- **编辑器草稿**：`markdown`、`knowledgeTitle`。
- **绑定关系**：`knowledgeEditingKnowledgeId`、`knowledgeTrashPreviewId`、`knowledgeLocalDirPath`、`knowledgeLocalDiskTitle`。
- **脏检查**：`knowledgePersistedSnapshot: { title, content }`。
- **Tauri 覆盖弹窗**：`knowledgeOverwriteOpen`、`knowledgeOverwriteTargetPath`、`knowledgePendingSavePayload`。
- **偏好（localStorage）**：`knowledgeOverwriteSaveEnabled`、`knowledgeAutoSaveEnabled`、`knowledgeAutoSaveIntervalSec`（key 以 `dnhyxc-ai.knowledge.*` 前缀存储）。
- **云端列表分页**：`list/total/pageNo/pageSize/titleKeyword/loading/loadingMore` + `onListViewportScroll`。
- **回收站分页**：`trashList/trashTotal/trashPageNo/trashPageSize/trashTitleKeyword/trashLoading/trashLoadingMore` + `onTrashListViewportScroll`。

#### 5.2 `KnowledgeListItem` / `KnowledgeRecord`（行为依赖）

- 本地扫描项会人为补：`id`、`localAbsolutePath`、`updatedAt`（ISO 字符串）等（见 `KnowledgeList.tsx`）。
- `KnowledgeRecord` 至少需要：`id/title/content/...` 用于 `handlePickRecord`。

---

### 6. 协议与接口契约（前端调用面）

> 下列路径常量名以 `service/index.ts` 为准（本文件不重复展开常量导入）。

#### 6.1 云端知识库

- **新建**：`POST /knowledge/save` body：`title/content/author/authorId`（`saveKnowledge`）。
- **列表**：`GET /knowledge/list` query：`pageNo/pageSize/title/authorId`（`getKnowledgeList`）。
- **详情**：`GET /knowledge/detail/:id`（`getKnowledgeDetail`）。
- **更新**：`PUT /knowledge/update/:id` body：`{ id, ...patch }`（`updateKnowledge`）。
- **删除**：`DELETE /knowledge/delete/:id`（`deleteKnowledge`）。

#### 6.2 回收站

- **列表**：`GET /knowledge/trash/list`。
- **详情**：`GET /knowledge/trash/detail/:id`。
- **删除单条**：`DELETE /knowledge/trash/delete/:id`。
- **批量删除**：`POST /knowledge/trash/delete-batch` body：`{ ids: string[] }` → `affected`。

#### 6.3 Tauri invoke（Rust 命令名，以 `knowledge-save.ts` 为准）

- `resolve_knowledge_markdown_target`
- `save_knowledge_markdown`
- `delete_knowledge_markdown`
- `list_knowledge_markdown_files`
- `read_knowledge_markdown_file`
- `open_knowledge_markdown_in_editor`（返回 `openedWith`）

---

### 7. 互斥与状态机（关键规则）

#### 7.1 保存路径互斥

- **浏览器 + 未登录**：禁止保存（normal 提示；auto 静默）。
- **本地 md id**：禁止云端 `save/update`（`persistKnowledgeApi` 早退），但仍可走 Tauri 保存（若 runtime 为 Tauri）。
- **自动保存**：依赖 **覆盖保存开关**；冲突时 auto 静默跳过；手动 normal 弹覆盖窗。

#### 7.2 列表模式互斥

- `KnowledgeList`：`useLocalFolder` 与 `allowCloudList` 组合决定数据源与开关禁用态。
- 未登录：强制本地模式且云端开关不可用。

#### 7.3 回收站预览 vs 正式编辑

- 预览：`knowledgeEditingKnowledgeId=null` 且 `knowledgeTrashPreviewId!=null`。
- 从列表打开正式条目：会清空 `knowledgeTrashPreviewId`（在 `setKnowledgeEditingKnowledgeId` 内）。

#### 7.4 助手持久化互斥（概要）

- `KnowledgeAssistant`：`assistantPersistenceAllowed` 决定 ephemeral 是否允许 flush；新建保存时的流式互斥由 `index.tsx` 处理（见 4.10）。

---

### 8. 性能与工程约束

#### 8.1 列表无限滚动

- 触底阈值：`72px`（`knowledgeStore` 常量）。
- 并发保护：`loadingMore` / `trashLoadingMore` 为 false 才触发下一页。

#### 8.2 自动保存防抖

- 每次标题/正文变化重置 timer；依赖快照字段避免无意义重启。

#### 8.3 快捷键监听

- 使用 `window.addEventListener(..., true)` 捕获阶段；保存/清空等需优先于 Monaco 默认行为。
- `pasteToAssistant`：**Monaco 内事件放行**，避免双处理（见 `index.tsx`）。

#### 8.4 助手消息列表

- `ResizeObserver` + `requestAnimationFrame` 刷新滚动角落按钮可见性；`useChatCodeFloatingToolbar` 以 `streamScrollTick` 等为依赖触发重新布局。

---

### 9. 错误提示与 Toast 规范（本页实际）

#### 9.1 典型 Toast

- **warning**：未登录浏览器保存、未登录打开云端条目、保存缺标题/缺正文、助手未登录、助手输入缺左侧正文等。
- **error**：列表/详情/删除/本地读写/Tauri invoke 失败、云端更新失败等。
- **success**：Tauri 保存成功、删除成功、追加助手内容成功等。

#### 9.2 静默策略

- **自动保存**：缺字段、未登录浏览器、冲突、覆盖弹窗打开、仍在 `saveLoading`：直接 return（不弹 Toast）。

---

### 10. 验收清单（可直接用于测试）

#### 10.1 路由与基础编辑

- [ ] 访问 `/knowledge`：能编辑标题与正文；标题 `100` 字符限制生效。
- [ ] 修改标题或正文后出现脏点；恢复为快照内容后脏点消失。

#### 10.2 未登录（浏览器）

- [ ] 打开知识库抽屉：不出现云端列表请求；只能本地模式提示（且本地不可用提示出现）。
- [ ] 手动保存：提示登录或引导桌面端；快照不应被错误更新为“已保存”。

#### 10.3 已登录（浏览器）

- [ ] 打开知识库抽屉：触发 `refreshList`；滚动到底加载更多。
- [ ] 打开一条：编辑器内容与详情一致；关闭抽屉。
- [ ] 更新保存：`editingKnowledgeId` 存在时走 update；成功后快照更新。
- [ ] 新建保存：无 `editingKnowledgeId` 时走 save；成功后 id 被写入且列表可刷新。

#### 10.4 回收站

- [ ] 打开回收站抽屉：列表加载；点行拉详情成功后编辑器展示内容且 `knowledgeTrashPreviewId` 有值。
- [ ] 从回收站预览点击保存：应创建新云端条目（编辑 id 为空）。
- [ ] 单行删除/批量删除：失败 toast；成功后列表刷新。

#### 10.5 Tauri：本地目录模式

- [ ] 切换本地文件夹：可选目录；列表展示 `.md` 文件；点击读取内容并生成 `__local_md__:` id。
- [ ] 外部编辑器打开：成功 toast 展示 `openedWith`。

#### 10.6 Tauri：保存与冲突

- [ ] 首次保存写入 `TAURI_KNOWLEDGE_DIR`（或本地条目目录）并 toast 展示路径。
- [ ] 同名冲突且未开启覆盖：出现覆盖弹窗；取消不写入。
- [ ] 覆盖保存：写入 `overwrite: true`；快照更新。
- [ ] 另存为：生成带时间后缀新文件名；云端另存为会新建记录。

#### 10.7 自动保存

- [ ] 关闭覆盖保存时：自动保存开关无法保持开启（被强制关闭）。
- [ ] 打开覆盖保存 + 自动保存：停止编辑超过间隔才触发保存；编辑中会重置计时器。

#### 10.8 助手与编辑器协同

- [ ] 未登录：页面不渲染助手区域。
- [ ] 登录：打开助手后能发送消息；流式中快捷卡片不可点。
- [ ] 「保存到知识库」：把助手正文追加到左侧 markdown。
- [ ] 新建保存成功：助手会话 key 迁移符合预期（含“流式中延迟 flush”用例，见 `docs/knowledge/knowledge-assistant-complete.md`）。

#### 10.9 快捷键

- [ ] 在系统设置修改知识库快捷键后：本页 Tooltip/行为可通过 `KNOWLEDGE_SHORTCUTS_CHANGED_EVENT` 更新（无需刷新整页）。
- [ ] `pasteToAssistant`：Monaco 内不拦截；Monaco 外不误粘贴剪贴板。
