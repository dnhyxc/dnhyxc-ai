# Monaco Markdown 编辑器：右键上下文菜单（Design ContextMenu）

## 1. 目标与范围

在 **`apps/frontend/src/components/design/Monaco/index.tsx`**（`MarkdownEditor`）的主编辑区域提供**与快捷键一致**的右键菜单：复制 / 剪切 / 粘贴 / 全选 / 格式化（Markdown 走安全格式化，其它语言走 Monaco 默认格式化）。

**当前接入范围**：

- 纯 **编辑** 视图下的主编器；
- Markdown **分屏** 左侧主编器。

**未接入**（可后续扩展）：

- **分屏 Diff** 右侧的 `DiffEditor`（只读对照，需单独考虑菜单项与模型来源）。

---

## 2. 分层与依赖关系

| 层级 | 路径 | 职责 |
|------|------|------|
| UI 原语 | `apps/frontend/src/components/ui/context-menu.tsx` | Radix（`radix-ui`）+ Tailwind，**单一事实来源**的样式与无障碍行为；**业务与 Monaco 不直接改此文件**。 |
| Design 二次封装 | `apps/frontend/src/components/design/ContextMenu/` | 在 UI 之上 `memo`、声明式 `QuickContextMenu`、`ContextMenuUi` 命名空间导出等，见该目录 `index.tsx` 顶部说明。 |
| Monaco 菜单模块 | `apps/frontend/src/components/design/Monaco/contextMenu.ts` | 菜单项生成（纯函数）+ 动作注入（与 `addCommand` 同源）；把右键菜单从 `index.tsx` 中拆出，便于复用与单点优化。 |
| Monaco 宿主 | `apps/frontend/src/components/design/Monaco/index.tsx` | 用 **`QuickContextMenu`** 包住带 **`editorHostRef`** 的宿主 `div`，菜单 **`items`** 来自 `contextMenu.ts`，`onMount` 通过注入函数绑定动作。 |

依赖方向：**Monaco → Design ContextMenu → UI context-menu**（单向，无循环引用）。

---

## 3. 实现思路（摘要）

1. **关闭 Monaco 内置右键菜单**  
   全局默认已在 **`apps/frontend/src/components/design/Monaco/options.ts`** 中设置 **`contextmenu: false`**，避免与 Radix 菜单抢事件；否则 Monaco 可能 `preventDefault`，外层收不到 `contextmenu`。

2. **动作与快捷键同源**  
   Tauri/WebView 下复制粘贴不可靠，主编器已在 `onMount` 里用 **`editor.addCommand`** 绑定 **Ctrl/⌘+C/X/V**（见 **`monaco/clipboard-global-handler-bypass.md`**、**`monaco/cut-line-without-selection-cmd-x.md`**）。  
   右键项不重复实现业务规则，而是由 **`apps/frontend/src/components/design/Monaco/contextMenu.ts`** 把**同一套闭包逻辑**注入到 **`editorContextActionsRef`**，菜单只调 `ref.current?.copy()` 等。

3. **声明式菜单 + 稳定 `items`**  
   使用 **`QuickContextMenu`** + **`useMemo([readOnly, language])`** 生成 **`editorContextMenuItems`**，只读时隐藏剪切/粘贴/格式化；`onSelect` 内仅调 ref，避免把整份 `handleEditorMount` 拉进 `useMemo` 依赖。

4. **触发区域与布局**  
   **`QuickContextMenu`** 默认 **`triggerAsChild`**：子节点必须是**单个**可合并 props 的元素，此处为带 **`editorHostRef`** 的宿主 **`div`**（与原有 **`ResizeObserver` / `layout` 测量**一致，不额外包一层抢尺寸的 DOM）。

5. **生命周期**  
   在 **`editor.onDidDispose`** 与组件卸载 **`useEffect`** 中将 **`editorContextActionsRef.current = null`**，防止卸载后仍点菜单。

---

## 4. 先决条件：`contextmenu: false`

下列为 **`options.ts`** 中与右键相关的片段（合并进 `mergedEditorOptions` 后同样生效）：

```typescript
// apps/frontend/src/components/design/Monaco/options.ts
// 关闭 Monaco 自带右键菜单，便于外层 Radix ContextMenu 接收 contextmenu 事件
export const options: any = {
	// ...其它选项
	contextmenu: false,
	// ...
};
```

---

## 5. Monaco 侧：ref + `useMemo` 菜单项

### 5.1 `editorContextActionsRef` 与 `editorContextMenuItems`

**设计意图注释**（与源码一致）：

- `editorContextActionsRef`：**onMount 注入**，供右键与快捷键共用。
- `editorContextMenuItems`：**主编辑器右键菜单**，依赖 ref；`readOnly` / `language` 变化时重建列表。

```typescript
// apps/frontend/src/components/design/Monaco/index.tsx（节选）

const editorRef = useRef<MonacoEditorInstance | null>(null);
/** onMount 注入：右键菜单与 Cmd/Ctrl+C/V/X 等同源 */
const editorContextActionsRef = useRef<MonacoEditorContextActions | null>(null);
/** 包裹 Editor 的宿主，用于测量 client 尺寸并显式 layout（Tauri 全屏恢复后避免沿用旧宽度） */
const editorHostRef = useRef<HTMLDivElement | null>(null);

// ...

/** 主编辑器右键菜单（与快捷键逻辑一致，依赖 editorContextActionsRef） */
const editorContextMenuItems = useMemo(
	() =>
		buildMonacoEditorContextMenuItems({
			readOnly,
			language,
			actionsRef: editorContextActionsRef,
		}),
	[readOnly, language],
);
```

### 5.2 `onMount`：注入与 `onDidDispose` 清理

**注释要点**：与 **`addCommand(C/V/X)`** 之后紧接着赋值，保证剪贴板、无选区剪切、`safeFormatMarkdownValue` 与快捷键完全一致。

```typescript
// handleEditorMount 内，在 Ctrl/⌘+V 的 addCommand 之后：

injectMonacoEditorContextActions({
	editor,
	monaco,
	imeComposingRef,
	actionsRef: editorContextActionsRef,
	getCopyTextFromSelections,
	rangeForCutWhenCursorOnly,
	copyToClipboard,
	pasteFromClipboard,
	safeFormatMarkdownValue,
});

// editor.onDidDispose 开头：
editorContextActionsRef.current = null;
```

组件卸载时同样清空 ref（与 `getMarkdownFromEditorRef` 清理并列）：

```typescript
useEffect(() => {
	return () => {
		editorContextActionsRef.current = null;
		if (getMarkdownFromEditorRef) {
			getMarkdownFromEditorRef.current = null;
		}
	};
}, [getMarkdownFromEditorRef]);
```

### 5.3 JSX：`QuickContextMenu` 包裹宿主

**注释意图**：`triggerAsChild` 下**唯一子节点**为测量用的 **`div`**，`Editor` 仍在内层，不改变原有 layout 行为。

```tsx
{/* 单栏「编辑」模式 */}
<QuickContextMenu items={editorContextMenuItems} triggerAsChild>
	<div
		ref={editorHostRef}
		className="box-border h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]"
	>
		<Editor
			height={height}
			width="100%"
			/* ...path、onMount、options 等 */
		/>
	</div>
</QuickContextMenu>

{/* Markdown 分屏：左侧主编器 */}
<QuickContextMenu items={editorContextMenuItems} triggerAsChild>
	<div
		ref={editorHostRef}
		className="box-border h-full min-h-0 min-w-0 max-w-full w-full overflow-hidden contain-[inline-size]"
	>
		<Editor height="100%" width="100%" /* ... */ />
	</div>
</QuickContextMenu>
```

---

## 6. Design：`QuickContextMenu` 职责简述

**文件**：`apps/frontend/src/components/design/ContextMenu/QuickContextMenu.tsx`

- 组合 **`ContextMenu` / `ContextMenuTrigger` / `ContextMenuContent`** 与递归的 **`QuickMenuEntries`**（支持 `item` / `separator` / `sub`）。
- 根组件 **`React.memo`**；`items` 建议调用方 **`useMemo`** 稳定引用（见文件内 JSDoc）。

```typescript
// QuickContextMenuProps（节选，注释与源码一致）
export interface QuickContextMenuProps {
	/** 右键/长按触发区域；默认 `triggerAsChild` 为 true 时需为单个可合并 props 的子元素 */
	children: React.ReactNode;
	/** 菜单结构（建议调用方用 `useMemo` 稳定引用以减少子树重渲染） */
	items: readonly QuickContextMenuEntry[];
	/** 与 Radix Trigger 一致：为 true 时不包裹额外 DOM */
	triggerAsChild?: boolean;
	// ...
}
```

---

## 7. 相关文件索引

| 文件 | 说明 |
|------|------|
| `apps/frontend/src/components/design/Monaco/contextMenu.ts` | `buildMonacoEditorContextMenuItems`（菜单项生成）、`injectMonacoEditorContextActions`（动作注入）与 `MonacoEditorContextActions` 类型 |
| `apps/frontend/src/components/design/Monaco/index.tsx` | 右键菜单装配：`editorContextActionsRef`、`editorContextMenuItems`、`QuickContextMenu`、`handleEditorMount` 中调用注入函数 |
| `apps/frontend/src/components/design/Monaco/options.ts` | `contextmenu: false` |
| `apps/frontend/src/components/design/ContextMenu/QuickContextMenu.tsx` | 声明式右键菜单 |
| `apps/frontend/src/components/design/ContextMenu/types.ts` | `QuickContextMenuEntry` 等类型 |
| `apps/frontend/src/components/design/ContextMenu/primitives.tsx` | 对 `ui/context-menu` 的 memo 二次封装 |
| `apps/frontend/src/components/ui/context-menu.tsx` | Radix + 样式原语 |
| `apps/frontend/src/utils/clipboard.ts` | `copyToClipboard` / `pasteFromClipboard` |
| `monaco/clipboard-global-handler-bypass.md` | Monaco 与 Tauri 剪贴板总览 |
| `monaco/cut-line-without-selection-cmd-x.md` | 无选区剪切整行 |

---

## 8. 排查与优化提示

- **右键无菜单**：确认 `mergedEditorOptions` 是否仍包含 **`contextmenu: false`**；检查 Monaco 是否在某处改写了 `contextmenu`。
- **菜单点了没反应**：多为 **`editorContextActionsRef` 尚未注入**（`onMount` 未完成）或已 **`onDidDispose` 清空**；挂载完成前菜单通常不会稳定出现。
- **与快捷键行为不一致**：应把差异收敛到 **`editorContextActionsRef` 与 `addCommand` 共用的一段逻辑**，避免只在菜单里改一份。

行号会随提交漂移，**以仓库当前文件为准**；本文中的代码块用于说明结构与注释意图。
