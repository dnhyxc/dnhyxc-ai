# Markdown 分屏修改对照（Diff）实现说明

本文档说明在 `MarkdownEditor`（`apps/frontend/src/components/design/Monaco/index.tsx`）中，**分屏左编右预览**与**分屏左编右只读 Diff 对照**的设计思路、状态划分、与跟滚/布局的衔接方式，便于后续维护或接入「对照基线来自已保存版本」等业务能力。

相关代码文件：

- 主实现：`apps/frontend/src/components/design/Monaco/index.tsx`
- 换行归一化等工具：`apps/frontend/src/components/design/Monaco/utils.ts`（`normalizeMonacoEol` 等）
- 玻璃主题（含粘性条占位透明）：`apps/frontend/src/components/design/Monaco/glassTheme.ts`
- 全局粘性条样式覆盖：`apps/frontend/src/index.css`（`html, body` 内 `.monaco-editor` / `.sticky-widget` 等）
- Monaco 默认 options（stickyScroll 默认值会被组件 props 覆盖）：`apps/frontend/src/components/design/Monaco/options.ts`
- 分屏跟滚（与本文模式互斥的预览侧逻辑）：`docs/monaco-markdown-split-scroll-sync.md`

---

## 1. 目标与交互

| 能力 | 说明 |
|------|------|
| 对照展示 | 类似 VS Code 的并排 Diff（side-by-side）：**左侧为快照（original）**，**右侧为当前正文（modified）**，由 Monaco 绘制增删改高亮。 |
| 可编辑性 | **仅左侧主编辑器**可编辑；Diff 区域整体 **只读**（不在 Diff 内改正文）。 |
| 与「分屏」关系 | **「分屏」（左编右预览）**与**「分屏对照」（左编右 Diff）**在视图状态上 **互斥**：不会同时高亮「分屏」Tab 与对照模式；进入对照即离开「纯分屏+预览」语义。 |
| 基线（baseline）来源 | 当前实现：用户**开启对照瞬间**，从主编辑器（或兜底 `value`）读取全文并 `normalizeMonacoEol` 后写入快照；**非**磁盘上次保存（若需要可由业务传入并替换该快照逻辑）。 |
| 粘性滚动（sticky scroll） | 由外部参数控制是否开启；**主编辑器与 Diff 两侧**同步使用同一组参数（见 §13.5）。 |

底部操作栏：在「预览」左侧增加 `GitCompare` 按钮，用于进入/退出 `splitDiff`。

---

## 2. 设计思路（为何用独立 `splitDiff` 而非「split + 布尔」）

### 2.1 问题

若用 `viewMode === 'split'` 再叠一层 `diffEnabled` 布尔：

- Tab 语义容易矛盾：用户看到「分屏」被选中，右侧却是 Diff 而非预览。
- 条件分支变多：`split && !diff`、`split && diff` 散落在跟滚、预览 `viewportRef`、布局等处，易漏判。

### 2.2 做法

将 Markdown 视图扩展为四种互斥模式（类型别名 `MarkdownViewMode`）：

- `edit`：单栏编辑。
- `preview`：单栏预览。
- `split`：**左编 + 右预览**（原有分屏）。
- `splitDiff`：**左编 + 右只读 Diff**（新增）。

「分屏」Tab 的 `aria-selected` **仅**在 `viewMode === 'split'` 时为真；进入 `splitDiff` 时「分屏」不高亮，**对照按钮**用 `aria-pressed` 表示开启。二者产品语义清晰、代码分支与跟滚条件可统一用 `viewMode` 表达。

---

## 3. 状态与数据流

### 3.1 视图状态

```ts
// 语义：split 与 splitDiff 互斥，由 viewMode 单字段表达
type MarkdownViewMode = 'edit' | 'preview' | 'split' | 'splitDiff';
```

### 3.2 快照状态 `diffBaselineOriginal`

- **写入时机**：用户从非 `splitDiff` 点击开启对照时，在 `toggleMarkdownSplitDiffCompare` 内 `setDiffBaselineOriginal(base)`，其中 `base` 来自 `editorRef.current?.getValue()`，兜底 `valueFromPropsRef.current`（避免未挂载编辑器时无值）。
- **清空时机**：
  - `useEffect` 依赖 `viewMode`：当 `viewMode !== 'splitDiff'` 时清空，避免 baseline 残留在其它模式。
  - `documentIdentity` 变化：`splitDiff` 时退回 `edit`，随后同上逻辑清空。

### 3.3 Diff 右侧（modified）正文

与受控 `value` / 主编辑器模型一致，使用即时正文（与分屏预览同样避免 `useDeferredValue` 滞后）：

```ts
// splitDiff 下右侧 Diff 的 modified 与父级 value 同步
const splitDiffModifiedText =
  viewMode === 'splitDiff' ? normalizeMonacoEol(value ?? '') : '';
```

左侧主编辑器仍通过既有 `onChange` / `setValue` 同步逻辑与父组件一致；**不在 Diff 内**写回 modified，避免双源编辑。

---

## 4. Monaco DiffEditor 接入要点

### 4.1 依赖

使用 `@monaco-editor/react` 的 **`DiffEditor`**（与 `Editor` 同源包），在 `beforeMount` 中复用与主编辑器相同的主题与语言扩展注册（`handleMonacoBeforeMount`）。

### 4.2 模型路径（避免与主编辑器 URI 冲突）

为 original / modified 各建独立 `*ModelPath`（`useMemo` + `documentIdentity` 消毒后缀），避免与主 `Editor` 的 `path={monacoModelPath}` 抢同一 URI。

### 4.3 只读与折行

`mergedDiffEditorOptions` 中：

- `readOnly: true`：整块 Diff **两侧均不可编辑**（满足「仅左侧主编辑器可改」）。
- `automaticLayout: false`：与主编辑器一致，**由宿主测量后显式 `layout()`**，减少 Tauri / WebView 全屏切换后尺寸陈旧问题（见 `docs/monaco-editor-tauri-layout.md`）。
- Markdown 时传入与主编辑器一致的 `wordWrap` / `wordWrapColumn`。
- `stickyScroll`：与主编辑器一致，**由外部 props**（`stickyScrollEnabled` / `stickyScrollScrollWithEditor`）控制；为避免 Diff 两侧子编辑器不继承顶层配置，`originalEditor` / `modifiedEditor` 也显式同步（见源码 `mergedDiffEditorOptions`）。

### 4.4 Diff 的 `layout`（类型限制）

当前 TypeScript 上的 `IStandaloneDiffEditor` **无** `getDomNode()`，因此**不**从 Diff 实例取 DOM 测宽高；统一用外层包裹 `div` 的 `ref={diffEditorHostRef}` 的 `clientWidth` / `clientHeight` 调用 `diffEd.layout({ width, height })`，并在 `ResizeObserver`、窗口 `resize`、`visualViewport`、`fullscreenchange` 上与主编辑器策略对齐。

---

## 5. 与「分屏跟滚」的隔离

`splitDiff` 右侧是 Monaco Diff，**没有** `ParserMarkdownPreviewPane` 的滚动容器，`previewViewportRef` 为空。若仍走「编辑 ↔ 预览」滚动同步，会空指针或逻辑无意义。

因此引入 **`splitPreviewScrollSyncEligible`**：

```ts
// 仅「左编右预览」且开启跟滚时才做锚点测量与双向同步
const splitPreviewScrollSyncEligible =
  viewMode === 'split' && scrollFollowActive && isMarkdown;
```

在以下路径对 `splitDiff` 早退（使用 **`viewModeRef.current === 'splitDiff'`**，避免滚动回调闭包滞后）：

- `flushEditorScrollToPreviewSync`
- `syncEditorFromPreview`
- `syncEditorFromPreview`

`useLayoutEffect` / `useEffect` 中重建快照、监听预览 `ResizeObserver` 的逻辑统一以 `splitPreviewScrollSyncEligible` 为门禁。

底部栏「跟滚」一组按钮本身仍仅在 `viewMode === 'split'` 时渲染，故 `splitDiff` 下不会误显。

---

## 6. 换篇（`documentIdentity`）

换篇时必须退出 `splitDiff`，否则 baseline 属于上一篇文档，Diff 语义错误：

```ts
useEffect(() => {
  setViewMode((vm) => (vm === 'splitDiff' ? 'edit' : vm));
}, [documentIdentity]);
```

其它模式（如 `split`）保持不变；`splitDiff` 强制回到 `edit`，再由 `viewMode` 的 `useEffect` 清空 `diffBaselineOriginal`。

---

## 7. 关键代码位置索引（便于跳转）

| 主题 | 文件内大致位置 |
|------|----------------|
| `MarkdownViewMode` 含 `splitDiff` | 类型定义靠近文件顶部 |
| `diffBaselineOriginal` / `splitDiffModifiedText` | state 与派生变量区 |
| `viewMode !== 'splitDiff'` 清空 baseline | `useEffect` |
| 换篇退出 `splitDiff` | `useEffect([documentIdentity])` |
| `mergedDiffEditorOptions` | `useMemo` |
| `diffOriginalModelPath` / `diffModifiedModelPath` | `useMemo` |
| `splitPreviewScrollSyncEligible` | `viewMode === 'split' && …` |
| 滚动同步早退 | `flushEditorScrollToPreviewSync`、`syncEditorFromPreview`、`syncEditorFromPreview` |
| `handleDiffEditorMount` | `DiffOnMount` 回调：布局与监听 |
| 分栏 JSX：`split \|\| splitDiff`、右侧 Diff / 预览分支 | `ResizablePanelGroup` 一段 |
| 底部栏 `GitCompare` 与 `toggleMarkdownSplitDiffCompare` | 底部 `role="toolbar"` 区域 |

---

## 8. 摘录：类型与状态（带注释）

以下为从实现文件中整理的逻辑等价摘录，**行号以仓库当前版本为准**；若代码移动请以语义为准。

```typescript
/**
 * Markdown 四态视图：
 * - edit / preview：单栏
 * - split：左源码编辑器 + 右 HTML 预览（跟滚仅在此模式有意义）
 * - splitDiff：左源码编辑器 + 右 Monaco Diff（与 split 互斥，不复用「分屏」Tab 选中态）
 */
type MarkdownViewMode = 'edit' | 'preview' | 'split' | 'splitDiff';

// 进入 splitDiff 时写入；离开 splitDiff 时由 effect 清空
const [diffBaselineOriginal, setDiffBaselineOriginal] = useState('');

// Diff 右侧：与 props value 一致，保证与左侧主编辑器展示同源
const splitDiffModifiedText =
  viewMode === 'splitDiff' ? normalizeMonacoEol(value ?? '') : '';

// 仅 split + 跟滚：避免 splitDiff 下无预览 viewport 仍参与同步
const splitPreviewScrollSyncEligible =
  viewMode === 'split' && scrollFollowActive && isMarkdown;
```

---

## 9. 摘录：切换对照（带注释）

```typescript
/**
 * 分屏对照开关（与「分屏」Tab 互斥）：
 * - 已在 splitDiff：回到 edit 单栏
 * - 否则：快照当前正文为 original，进入 splitDiff（左编 + 右 Diff）
 */
const toggleMarkdownSplitDiffCompare = useCallback(() => {
  if (viewMode === 'splitDiff') {
    setViewMode('edit');
    queueMicrotask(focusEditor);
    return;
  }
  const base = normalizeMonacoEol(
    editorRef.current?.getValue() ?? valueFromPropsRef.current ?? '',
  );
  setDiffBaselineOriginal(base);
  setViewMode('splitDiff');
  queueMicrotask(focusEditor);
}, [viewMode, focusEditor]);
```

---

## 10. 摘录：条件渲染结构（带注释）

```tsx
{/* 分屏与分屏对照共用同一套 Resizable 两栏，仅右侧内容不同 */}
{isMarkdown && (viewMode === 'split' || viewMode === 'splitDiff') ? (
  <ResizablePanelGroup orientation="horizontal">
    <ResizablePanel>{/* 左侧：始终为单一 Monaco Editor，可编辑 */}</ResizablePanel>
    <ResizableHandle withHandle />
    <ResizablePanel>
      {viewMode === 'splitDiff' ? (
        <div ref={diffEditorHostRef}>
          <DiffEditor
            original={diffBaselineOriginal}
            modified={splitDiffModifiedText}
            originalModelPath={diffOriginalModelPath}
            modifiedModelPath={diffModifiedModelPath}
            options={mergedDiffEditorOptions} // readOnly: true 等
            onMount={handleDiffEditorMount}
          />
        </div>
      ) : (
        <ParserMarkdownPreviewPane markdown={splitPaneMarkdown} /* ... */ />
      )}
    </ResizablePanel>
  </ResizablePanelGroup>
) : null}
```

---

## 11. 后续扩展建议

1. **基线来自已保存版本**：增加可选 prop（如 `diffCompareBaseline?: string`），在开启 `splitDiff` 时优先用该字符串作为 `original`，无则仍用当前「点击瞬间快照」。
2. **重新对齐基线**：在 `splitDiff` 工具栏增加「以当前内容为新的对照基准」按钮，仅更新 `diffBaselineOriginal` 而不退出模式。
3. **与跟滚文档的关系**：实现跟滚的细节仍以 `docs/monaco-markdown-split-scroll-sync.md` 为准；本文仅说明 **splitDiff 必须从该链路中排除** 的原因与门禁变量。

---

## 12. 小结

- 用 **`splitDiff` 独立视图**表达「分屏对照」，与 **`split`（左编右预览）** 在状态机层面互斥，避免 Tab 语义与条件分支纠缠。
- Diff 使用 **`DiffEditor` + `readOnly` + 外层宿主显式 layout**，与主编辑器 Tauri/WebView 布局策略一致。
- **预览跟滚**严格限制在 `viewMode === 'split'`，并在滚动相关回调里对 **`splitDiff` 早退**，避免空 `viewportRef` 与无效同步。

---

## 13. 粘性滚动条（sticky scroll）背景与 CSS 覆盖

本节说明：**为何**在玻璃主题 `defineTheme` 里直接写 `var()` / `color-mix` 或误用 `--theme-color` 会导致粘性条异常色；**最终方案**（`glassTheme.ts` + `index.css`）；以及与 **Diff 分栏内嵌双编辑器** 的关系。普通 Markdown 单栏编辑与 **splitDiff** 下 Diff 两侧子编辑器 **共用** 同一套全局 CSS，维护时一并考虑。

### 13.1 什么是粘性滚动

在 Monaco（与 VS Code 同源）中，**粘性滚动（sticky scroll）** 指编辑长文件时，在视口顶部「钉住」当前所在的**外层语法块标题行**（如类名、函数名），便于始终知道上下文。对应 DOM 上常见类名为 **`.sticky-widget`**，主题里对应颜色键为：

| 颜色键（Monaco `colors` / CSS 变量） | 含义 |
|--------------------------------------|------|
| `editorStickyScroll.background` | 常态背景 |
| `editorStickyScrollHover.background` | 悬停背景 |

Monaco 会把主题中的颜色写入编辑器 DOM 上的 **`--vscode-editorStickyScroll-background`** 等变量，由内部样式消费。

### 13.2 本仓库中的目标

- 编辑区整体为 **玻璃效果**（`editor.background` 等透明，透出外层 `bg-theme/5`），见 `glassTheme.ts`。
- 粘性条需要 **与产品主题协调** 的可读底色，且随 **`body` / `.dark` 与各主题预设** 下的 CSS 变量变化。
- **分屏 Diff**（`DiffEditor`）内左右各有一个内嵌 **`.monaco-editor`**，样式必须 **一并命中**（见下文 `index.css` 选择器），否则只有普通编辑器生效。

### 13.3 走过的弯路（为何不要用 `defineTheme` 写 `var()` / `--theme-color`）

#### 13.3.1 在 `defineTheme({ colors })` 里写 `var(--theme-color)` 或 `color-mix(...)`

`monaco.editor.defineTheme` 的 `colors` 值在很多版本里会走 **Monaco 自己的颜色解析管线**（用于与内置主题合并、生成内部 token）。**并非所有值都会原样变成浏览器里的 CSS**：

- 若解析失败或走兜底路径，可能落到 **与预期不符的默认色**（实践中出现过 **偏红** 等与当前主题无关的观感）。
- 因此：**不要把依赖「运行时 CSS 变量」的复杂字符串，当作唯一手段写在 `glassTheme` 的粘性键上**。

#### 13.3.2 误用 `--theme-color` 作为「背景色」

在本项目 `index.css` 中，`--theme-color` 在**不同主题预设**下表示 **强调 / 品牌色**（高饱和、色相随主题变化），**不是**页面大面的「背景灰/底」。

- 若粘性条大面积使用 `--theme-color`，在部分主题下会呈现 **明显偏红或其它高饱和色**，与「跟页面背景一致」的预期不符。
- **背景系**应优先使用：`--theme-background`、`--theme-muted`、`--theme-secondary`、`--theme-card` 等（语义以 `index.css` 为准）。

### 13.4 最终方案（双轨）

#### 13.4.1 `glassTheme.ts`：粘性键保持「可解析的透明实色」

- **`editorStickyScroll.background` / `editorStickyScrollHover.background`** 设为 **`#00000000`（全透明）**。
- 目的：与玻璃编辑区一致；**不在主题层引入不可解析字符串**；真实可见背景交给 **`index.css`**，由浏览器解析 `var()` / `color-mix`。

```typescript
/**
 * 继承内置主题语法高亮，仅把编辑区相关层改为透明，透出外层 bg-theme/5。
 * 粘性滚动条背景勿在此写 var()/color-mix：Monaco defineTheme 解析失败易偏色；
 * 由 `index.css` 中 `--vscode-editorStickyScroll-*` 与 `.sticky-widget` 覆盖为应用主题变量。
 */
const GLASS_CHROME: Record<string, string> = {
	'editor.background': '#00000000',
	'editorGutter.background': '#00000000',
	'minimap.background': '#00000000',
	'editorOverviewRuler.background': '#00000000',
	// 全透明占位：实际底色见 index.css，避免 defineTheme 解析 var/color-mix 异常
	'editorStickyScroll.background': '#00000000',
	'editorStickyScrollHover.background': '#00000000',
};
```

#### 13.4.2 `index.css`：覆盖语义变量 + `.sticky-widget` 实背景

文件：`apps/frontend/src/index.css`（挂在 `html, body { ... }` 内，与 `.monaco-editor .find-widget` 等同级）

**两层：**

1. **在 `.monaco-editor` 上重写 VS Code 语义变量**  
   Monaco 内部仍读 `--vscode-editorStickyScroll-background`，值由我们提供；**浏览器原生**解析 `color-mix` 与 `var(--theme-secondary)`，不经过 Monaco 颜色解析器。

2. **直接给 `.sticky-widget` 写 `background-color`**  
   防止子层仍用旧背景；使用 **`!important`** 覆盖内联或主题注入。

**选择器为何带 `.monaco-diff-editor .monaco-editor`？**

- **Diff 分栏**：根节点多为 **`.monaco-diff-editor`**，左右各嵌 **`.monaco-editor`**；显式写出可让代码审查时意图清晰，并与部分 DOM 变体兼容。

**当前仓库中的颜色（以 `index.css` 为准，可按产品调）**：

- 使用 **`color-mix(in oklch, var(--theme-secondary) 80%, transparent)`** 作为粘性条与悬停底色（偏浅玻璃条）。
- 若需 **更贴近整页底**：可把 `var(--theme-secondary)` 改为 **`var(--theme-background)`** 或 **`var(--theme-muted)`**。

```css
/*
 * Monaco 粘性滚动（sticky scroll）：
 * 1）defineTheme 里写 var()/color-mix 易解析失败 → 异常色；
 * 2）此处由浏览器解析，并覆盖 --vscode-* 与 .sticky-widget；
 * 3）Diff 内嵌多实例 .monaco-editor，选择器需命中。
 */
.monaco-editor,
.monaco-diff-editor .monaco-editor {
	/* Monaco 内部消费：主题次要底 + 透明混合，避免误用 --theme-color（强调色） */
	--vscode-editorStickyScroll-background: color-mix(
		in oklch,
		var(--theme-secondary) 80%,
		transparent
	) !important;
	--vscode-editorStickyScrollHover-background: color-mix(
		in oklch,
		var(--theme-secondary) 80%,
		transparent
	) !important;
}

.monaco-editor .sticky-widget,
.monaco-diff-editor .monaco-editor .sticky-widget {
	background-color: color-mix(
		in oklch,
		var(--theme-secondary) 80%,
		transparent
	) !important;
}

.monaco-editor .sticky-widget:hover,
.monaco-diff-editor .monaco-editor .sticky-widget:hover {
	/* 悬停可与常态相同，或改为更高比例的 theme-muted / theme-background */
	background-color: color-mix(
		in oklch,
		var(--theme-secondary) 80%,
		transparent
	) !important;
}
```

### 13.5 与 `options.ts` 的关系

文件：`apps/frontend/src/components/design/Monaco/options.ts`

#### 13.5.1 默认值 vs 组件外部覆盖

- **`options.ts`** 提供 Monaco 通用默认配置，其中包含：
  - `stickyScroll: { enabled: true, scrollWithEditor: true }`
- **`MarkdownEditor`** 会在运行时用外部 props 覆盖该默认值，使业务层可控：
  - `stickyScrollEnabled?: boolean`：是否开启粘性滚动（默认 `true`）
  - `stickyScrollScrollWithEditor?: boolean`：粘性条是否跟随横向滚动（默认 `true`）
- **覆盖范围**：
  - 主编辑器：在 `mergedEditorOptions` 中覆盖 `stickyScroll`
  - Diff 编辑器：在 `mergedDiffEditorOptions` 中同步 `stickyScroll`，并对 `originalEditor` / `modifiedEditor` 两侧子编辑器显式同步，避免部分版本仅对顶层生效

#### 13.5.2 背景色与开关的分离

- **开关**由 `stickyScrollEnabled` 等 props / `stickyScroll` options 控制。
- **背景色**由「主题透明 + `index.css` 覆盖 `--vscode-editorStickyScroll-*` / `.sticky-widget`」完成（见 §13.4）。

若需关闭粘性滚动以规避极端场景 bug，可改 `enabled: false`；详见 `docs/monaco-markdown-ime-ghosting.md`。

### 13.6 维护清单（粘性条）

| 操作 | 建议 |
|------|------|
| 改粘性条颜色 | 优先改 **`index.css`** 中 `color-mix` 与变量名；**避免**在 `glassTheme.ts` 的粘性键上写 `var()`。 |
| 换主题 token 命名 | 同步检查 `index.css` 里 `--theme-*` 是否仍存在于 `:root` / `.dark` / `body.theme-*`。 |
| 升级 Monaco 大版本 | 抽查 DOM 是否仍使用 `.sticky-widget` 与 `--vscode-editorStickyScroll-*`。 |
| 排查「仍是红/异常色」 | 查是否有别处对 `.sticky-widget` 或 `--vscode-editorStickyScroll-*` 更高优先级覆盖；用开发者工具看**计算后的 background**。 |

### 13.7 小结（粘性条）

- **`defineTheme` 的 `colors`**：粘性键用 **`#00000000`** 占位，**不写**依赖运行时 CSS 变量的字符串。  
- **全局 CSS**：在 **`.monaco-editor` / `.monaco-diff-editor .monaco-editor`** 上覆盖 **`--vscode-editorStickyScroll-*`**，并给 **`.sticky-widget`** 写 **`background-color`**。  
- **语义**：**`--theme-color` 为强调色**，勿作大面积粘性条底；背景系用 **`--theme-background` / `--theme-muted` / `--theme-secondary`** 等。

---

## 14. 扩展阅读

- 分屏跟滚：`docs/monaco-markdown-split-scroll-sync.md`
- Tauri / WebView 下 Monaco 显式布局：`docs/monaco-editor-tauri-layout.md`
- Markdown IME 与装饰层（含 sticky 开关讨论）：`docs/monaco-markdown-ime-ghosting.md`
