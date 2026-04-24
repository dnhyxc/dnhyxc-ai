### Monaco MarkdownEditor（企业级编辑器模块）SPEC

本 SPEC 以当前实现为准，覆盖 `apps/frontend/src/components/design/Monaco/*` 以及其依赖的 Markdown 预览、底部操作栏、快捷键、右键菜单、剪贴板适配、Prettier 格式化、分屏滚动同步、Diff 对照、以及“右侧助手面板”联动能力。目标是把“实现即规范”沉淀为可验收、可扩展、可维护的企业级规格说明。

---

### 1. 模块边界与文件结构

#### 1.1 入口与核心文件

- **入口组件**：`apps/frontend/src/components/design/Monaco/index.tsx`
  - 组件名：`MarkdownEditor`
  - 依赖：`@monaco-editor/react` 的 `Editor` 与 `DiffEditor`
  - Markdown 专属能力（预览/分屏/底部栏/助手/对照）全部在此收敛
- **底部操作栏**：`MarkdownBottomBar.tsx`
  - 负责：拖拽定位、视图/助手/分屏/对照切换、跟随滚动模式、覆盖保存/自动保存开关与间隔、复位按钮、自定义节点插槽
- **预览渲染**：`MarkdownPreview.tsx`
  - 负责：将 Markdown 渲染为 HTML，支持 Mermaid（图表）围栏岛、代码块工具栏、hash/目录跳转、右下角置底/置顶浮动按钮（纯预览模式）
- **快捷键绑定（底部栏）**：`useMarkdownBottomBarShortcuts.ts`（在 hooks 目录）
  - 负责：全局 keydown 捕获，按 chord（和弦键）命中触发底部栏动作；可注入快捷键数据源与匹配规则
- **右键菜单与动作注入**：`contextMenu.ts`
  - 负责：生成菜单项、将 copy/cut/paste/selectAll/format/sendSelectionToAssistant 等动作注入到 ref，保证“右键菜单”与“快捷键命令”同源
- **编辑器命令（快捷键）**：`commands.ts`
  - 负责：集中注册 Monaco `addCommand`（复制/剪切/粘贴/格式化/发送选区到助手），并处理 IME（输入法）合成态
- **格式化**：`format.ts`
  - 负责：注册 Prettier provider；以及 Markdown “安全格式化”（避免 fenced code block 围栏被错误升级/缩进破坏）
- **主题玻璃化**：`glassTheme.ts`
  - 负责：在继承内置主题的基础上将 editor 背景层透明，透出外层 UI
- **Markdown 围栏嵌入高亮**：`markdownTokens.ts`
  - 负责：Monaco markdown token provider 补丁，让 ```tsx/ts/js/... 围栏内能按嵌入语言高亮
- **工具与滚动同步**：`utils.ts`
  - 负责：分屏滚动同步快照与插值、Diff 入口可用性判定、底部栏拖拽吸附、EOL 规范化等
- **options**：`options.ts`
  - 负责：编辑器 options（禁用 pasteAs、字体栈、折行参考列等）

---

### 2. 组件 API（MarkdownEditorProps）与设计原则

#### 2.1 基础输入输出

- **value**：编辑器正文（字符串）
- **onChange(value)**：正文变化回调
  - Monaco 内部以 rAF 合并上报（避免每字符触发父组件更新）
  - blur/IME compositionEnd 会补一次上报，保证父状态最终一致
- **documentIdentity**：逻辑文档 id
  - 变化时必须“换 model/重置滚动/退出 Diff/关闭助手（非受控）”
  - 用于避免不同文档串内容、串滚动位置、串 Diff 基线

#### 2.2 Markdown 专属能力开关

- **enableMarkdownPreview**：是否启用 Markdown 预览与分屏能力（language==='markdown' 时默认 true）
- **showTabBar**：顶部“操作栏”按钮是否显示（与底部栏开合联动）
- **enableMarkdownBottomBar**：是否启用底部操作栏（默认 true）
  - false 时强制收起（避免“禁用后仍保留展开状态”）
- **enableMarkdownBottomBarToggleShortcut**：是否由组件内部监听“切换操作栏”的快捷键（默认 true）
- **shortcutSource**：快捷键数据源（注入点）
  - 包含：默认 chords、异步加载、订阅变更、chord 命中判定
  - 目标：组件可移植，不依赖项目级快捷键存储

#### 2.3 剪贴板适配器（adapter，适配层）

**clipboardAdapter**：
- `copyToClipboard(text)`：写入剪贴板
- `pasteFromClipboard()`：读取剪贴板文本

约束与目的：
- Web Clipboard 与 Tauri/WebView 环境差异较大，必须通过注入适配器统一 copy/cut/paste 行为
- 右键菜单与快捷键命令均使用同一适配器，保证一致性

#### 2.4 保存相关（仅 UI 配置，不含具体持久化实现）

该组件不直接“保存到磁盘/云端”，但提供**底部栏 UI 与状态变更回调**，供业务层实现：

- **overwriteSaveEnabled** + `onOverwriteSaveEnabledChange(enabled)`
  - 仅当回调存在时底部栏显示开关
- **autoSaveEnabled / autoSaveIntervalSec**
  - 仅当同时传入 `onAutoSaveEnabledChange` 与 `onAutoSaveIntervalSecChange` 时底部栏显示控制
  - 组件仅负责展示与回调；定时器与落盘逻辑由业务层实现
- **getMarkdownFromEditorRef**
  - 业务层可通过此 ref 读取“编辑器当前模型全文”，并在读取时同步触发 onChange（消除父状态滞后）

#### 2.5 右侧助手联动（知识库等场景）

- **bottomBarAssistantNode**：右侧助手面板的 React 节点（例如 KnowledgeAssistant）
- **markdownAssistantOpen / onMarkdownAssistantOpenChange**：助手面板受控模式
  - 两者都传入 → 受控
  - 否则 → 内部 state 管理
- **onInsertSelectionToAssistant(text)**：将“当前选区”写入外部输入框
  - 只处理非空选区（不降级复制整行）
  - 触发入口：
    - 右键菜单“复制选中内容到助手”（仅 enableSendSelectionToAssistant=true 时出现）
    - Ctrl/Cmd+Shift+V 命令（见 `commands.ts`）

#### 2.6 Diff 对照（splitDiff）

- **diffBaselineSource**：基线来源
  - `current`：点击进入对照瞬间的正文快照
  - `persisted`：外部传入的“打开时快照”（如知识库/回收站）
  - `empty`：空基线（适合新建草稿）
- **diffBaselineText**：当 source=persisted 时的基线正文

---

### 3. 视图模式与布局（edit / preview / split / splitDiff）

#### 3.1 视图模式定义

- **edit**：单栏编辑（Resizable 右栏隐藏但保留骨架，避免 edit→split 时 Editor 重挂载闪断）
- **preview**：纯预览（Editor 不渲染；右下角可选置底/置顶 FAB）
- **split**：左编辑 + 右预览（可选滚动同步）
- **splitDiff**：左编辑 + 右只读 Diff（右侧为 DiffEditor；与预览/助手互斥）

#### 3.2 ResizablePanelGroup（分栏骨架）

当 `isMarkdown && viewMode !== 'preview'`：
- 使用 `ResizablePanelGroup(horizontal)` 固定两栏：
  - 左：`Editor`（`keepCurrentModel`，`path=monacoModelPath`）
  - 右：三选一
    - 助手面板（`markdownAssistantOpen && bottomBarAssistantNode`）
    - DiffEditor（`viewMode==='splitDiff'`）
    - Markdown 预览（默认）
- edit 模式下右栏 `pointer-events-none opacity-0`（布局为 100/0）
- split/splitDiff 进入时恢复上次分栏比例（`lastSplitLayoutRef`）

#### 3.3 preview 模式为何单独渲染

- preview 下不渲染 panel group，避免无意义的 editor model 维护
- 预览正文使用 `useDeferredValue(value)`（降低大文档频繁渲染压力）
- 分屏预览则使用“即时正文” `splitPaneMarkdown`，避免 deferred 滞后导致滚动同步偏差

---

### 4. 分屏滚动同步（scroll follow）

#### 4.1 跟随模式（splitScrollFollowMode）

仅在 `viewMode==='split'` 且右侧为预览（非助手）时可用：

- `none`：不跟随
- `previewFollowsEditor`：滚编辑器驱动预览
- `editorFollowsPreview`：滚预览驱动编辑器
- `bidirectional`：双向同步（含回声抑制）

#### 4.2 快照（snapshot）与热路径插值

同步核心在 `utils.ts`：
- 冷路径：`buildMarkdownScrollSyncSnapshot(editor, viewport)`
  - 预览标题元素必须包含 `data-md-heading-line`，且行号与 Monaco 模型一致
  - 生成单调非降折线 `editorY[] -> previewY[]`（含文首/文末端点）
  - 无标题时退化为“整篇比例映射”（`useRatioFallback=true`）
- 热路径：
  - editor→preview：`syncPreviewScrollFromMarkdownEditor`
  - preview→editor：`syncEditorScrollFromMarkdownPreview`
  - 在折线上做分段线性插值，带 deadband（1.5px）避免双向抖动
  - 快照校验：行数、scrollHeight/clientHeight、editor content/viewport 高度等（eps=3px），失效则重建

#### 4.3 回声抑制（bidirectional）

通过两个 ref 实现“双向不打架”：
- `suppressPreviewScrollEchoRef`：编辑器驱动预览后，忽略下一次预览 scroll 回调
- `suppressEditorScrollEchoRef`：预览驱动编辑器后，忽略下一次 editor onDidScrollChange 回调
- 均采用双 rAF 清除抑制，覆盖 DOM/layout 异步更新窗口

---

### 5. Diff 对照（splitDiff）的基线与模型生命周期

#### 5.1 进入/退出对照

入口：`toggleMarkdownSplitDiffCompare()`（底部栏按钮/快捷键）
- 再次点击：退出对照并回到 edit（同时关闭助手）
- 进入前置：必须满足 `isMarkdownDiffEntryEligible(...)`（避免空对空）
- 每次进入都会 `diffSessionId++`
  - 目的：避免 `keepCurrentOriginalModel/keepCurrentModifiedModel` 复用旧模型导致内容残留

#### 5.2 基线选择规则

进入 splitDiff 时设置 `diffBaselineOriginal`：
- source=`empty`：基线为空
- source=`persisted`：用 `diffBaselineText`
- source=`current`：
  - 优先读 editor 当前模型（避免父级 onChange rAF 合并导致 value 滞后）
  - 若处于 preview（editor 可能卸载/陈旧）：回退到 `valueFromPropsRef`

#### 5.3 退出后的模型释放（防竞态）

由于 DiffEditor 保持 current model：
- 退出 splitDiff 后会双 rAF 延迟 dispose 对应 session 的 original/modified TextModel
- 并用 `activeDiffSessionRef` 防止快速切换导致误 dispose 当前会话的模型

---

### 6. 底部操作栏（MarkdownBottomBar）与快捷键体系

#### 6.1 操作栏开合

- 顶部“操作栏”按钮控制 `internalMarkdownBottomBarOpen`
- 支持快捷键：由 `useMarkdownBottomBarShortcuts` 统一监听（可关闭 enableMarkdownBottomBarToggleShortcut）

#### 6.2 底部栏按钮能力（功能点一览）

按钮含义（与 chords 对应）：

- **Action1**：编辑源码（强制关闭助手，切到 edit 并聚焦 editor）
- **Action2**：分屏对照 Diff（splitDiff 开关；与助手互斥）
- **Action3**：预览渲染（preview 开关；与助手互斥）
- **Action4**：AI 助手开关（仅当 `bottomBarAssistantNodeEnabled`）
- **Action5**：分屏预览（split 开关；若当前为纯 split 且无助手则回到 edit）
- **Action6/7/8**：分屏跟滚模式（仅 split 且右侧为预览时可用；助手占右栏时禁用）
  - 6：bidirectional
  - 7：previewFollowsEditor
  - 8：editorFollowsPreview
- **Action9**：覆盖保存开关（仅回调存在时显示）
- **Action0**：自动保存开关（仅回调存在时显示）
- **ResetPosition**：复位操作栏位置（imperative handle）

#### 6.3 拖拽定位与吸附

- 默认：水平居中 + 距底 10px
- 拖拽层仅在有偏移时才写 transform（保持“未拖动”与旧版合成一致）
- open=false 时解除 pointer 监听，避免收起后仍更新 offset
- root resize 时自动 snap（只夹紧 x，不动 y），防止溢出编辑器区域

---

### 7. 右键菜单、编辑器命令与剪贴板语义（企业级一致性）

#### 7.1 右键菜单项

由 `buildMonacoEditorContextMenuItems` 生成：
- 只读时：无 cut/paste/format
- 非只读：提供 cut/paste/format
- 始终提供：copy/selectAll
- 外部接入 `onInsertSelectionToAssistant` 时追加：
  - “复制选中内容到助手”（Ctrl/Cmd+Shift+V）

#### 7.2 Copy/Cut/Selection 的精确语义

- **Copy 语义**：
  - 有选区：复制选区
  - 无选区：复制当前行 + EOL
- **Selection 语义**（仅用于“写入助手输入框”）：
  - 只返回真实选区文本
  - 无选区返回空串（禁止降级为整行）
- **Cut 语义**：
  - 无选区时删除“当前逻辑行”，尽量对齐 VS Code 的换行处理

#### 7.3 命令与 IME 合成态约束

`commands.ts`：
- Ctrl/Cmd+C/X/V 走注入的 clipboardAdapter（适配 WebView/Tauri）
- 粘贴在 IME 合成态期间被跳过
- Ctrl/Cmd+Shift+V：
  - 只对真实选区生效
  - 先 flushEditorValueToParent
  - 再触发 sendSelectionToAssistant（优先复用注入动作）

---

### 8. 格式化与高亮（Markdown 质量保障）

#### 8.1 Prettier provider

- `registerPrettierFormatProviders` 在 beforeMount 注册
- 支持语言：markdown/js/ts/html/css/less/scss/yaml/json
- Markdown 走 `safeFormatMarkdownValue`

#### 8.2 Markdown 安全格式化（safe format）

`safeFormatMarkdownValue`：
- 优先用 Prettier format（embeddedLanguageFormatting=auto）
- 后处理：在“可证明安全”时将 4+ 反引号围栏降回 ```
- Prettier 失败降级：
  - 围栏外做轻量“盘古空格”
  - 围栏内容保持原样

#### 8.3 Markdown 围栏嵌入高亮

`registerMarkdownFenceEmbeddedHighlight`：
- 为 Monaco markdown tokenizer 增强围栏内嵌入语言高亮
- 仅影响编辑器显示，不影响格式化与渲染

---

### 9. 性能与稳定性约束（必须遵守）

- **automaticLayout 强制关闭**：由宿主尺寸显式 layout（ResizeObserver + window/visualViewport/fullscreenchange）
- **避免 Editor 受控 value 重渲染**：使用 defaultValue + keepCurrentModel；必要时才 setValue
- **IME 合成态保护**：合成期间不 push to parent、不执行自定义 paste
- **预览 deferred**：纯预览用 deferred；分屏用即时值
- **Diff 模型释放**：退出 splitDiff 双 rAF dispose，避免竞态
- **滚动同步快照**：失效才重建；deadband 防抖
- **Paste As 管线关闭**：避免网页/Office 粘贴破坏 Markdown 缩进/围栏
- **玻璃主题**：编辑器背景透明，sticky scroll 色通过 CSS 变量覆盖

---

### 10. 验收清单（可直接用于测试）

- 换篇后不串内容/滚动；退出 splitDiff；非受控模式关闭助手
- onChange rAF 合并正确；blur/compositionEnd 能最终同步
- edit/preview/split/splitDiff 互斥逻辑正确；助手占右栏时禁用预览跟滚按钮
- split 跟滚四种模式工作正常；bidirectional 不抖动
- Diff：空对空不可进；persisted 基线非空可展示全量删除；多次进入不复用旧内容
- Ctrl/Cmd+Shift+V：无选区不触发；有选区写入助手且触发前会先同步父级内容
- Shift+Alt+F：markdown 安全格式化不破坏围栏；其它语言格式化可用
- 底部操作栏可拖拽且不超出编辑器；收起后不再响应拖动；复位可恢复默认位置

