# EPUB 右侧分栏：MK 问书开启/关闭统一逻辑

## 文档角色

**增量专题**：统一顶栏 Bot、PopBar「MK 问书」、想法侧栏「MK 问书」的右侧分栏显隐；修复关闭 MK 后空白分栏、想法列表切换闪烁、划线误关助手等问题。

**延伸阅读**：[epub-thought-side-panel.md](./epub-thought-side-panel.md)、[epub-split-soft-resize.md](./epub-split-soft-resize.md)、[epub-quote-share.md](./epub-quote-share.md)、[epub-thought-list-delete-close.md](./epub-thought-list-delete-close.md)、[epub-context-menu-popbar.md](./epub-context-menu-popbar.md)、[epub-thought-quote-viewport.md](./epub-thought-quote-viewport.md)、[epub-split-panel-collapse.md](./epub-split-panel-collapse.md)（**关闭侧栏全宽恢复**，§4.5 三帧方案已 supersede）。

---

## 1. 背景与目标

### 1.1 问题

- 关闭 MK 问书后右侧仍占位空白（`sidePanelOpen` 与 `sidePanel` 内容错位，或 `setLayout` 未收至 0）。
- 想法列表点右上角关闭后，部分路径下右侧仍留空白列（`thoughtListOpen` / `cluster` / `returnToListClusterRef` 错位，`react-resizable-panels` 未完全 collapse）。
- 想法列表点「MK 问书」若先 `setThoughtListOpen(false)` 再开助手，中间一帧分栏收起导致左侧阅读区闪烁。
- 用 `sidePanel != null` 推导布局时，若划线 PopBar 仍 `setAssistantOpen(false)`，会误关 MK 问书。

### 1.2 目标

| 入口 | 打开 | 关闭 MK |
|------|------|---------|
| 顶栏 Bot | `assistantOpen=true`，不关想法 state | 无后台面板则分栏收起；有想法列表/详情则恢复显示 |
| PopBar MK 问书 | 同左，同步 `openAssistantWithSelection` | — |
| 想法引用条 MK 问书 | 同左，**不**先关想法列表 | 关 MK 后回到想法列表/详情 |

布局层：`sidePanelOpen` 与 **`assistantOpen` / `thoughtDialogOpen` / (`thoughtListOpen` && cluster)** 对齐，不再仅用 `sidePanel != null`；关闭列表时清空 `returnToListClusterRef` 防止 effect 误恢复。

---

## 2. 改动范围

| 路径 | 说明 |
|------|------|
| `apps/frontend/src/views/ebook/read.tsx` | `openAssistant` / `toggleAssistant`、`closeThoughtList`、`sidePanelOpen` 标志 |
| `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx` | `collapsible` + 三帧 `collapse()` + `hidden` + 条件渲染侧栏壳 |
| `apps/frontend/src/views/ebook/read.tsx` | 划线/定位 PopBar 不再 `setAssistantOpen(false)` |

---

## 3. 实现思路

1. **内容优先级**（不变）：`assistantOpen` → `thoughtDialogOpen` → `thoughtListOpen && cluster`。
2. **打开 MK**：只 `setAssistantOpen(true)`，**不**清除 `thoughtListOpen` / `thoughtDialogOpen`；`sidePanel` 切到 `EbookAssistant`，`sidePanelOpen` 仍为 true，**无宽度闪烁**。
3. **关闭 MK**：`setAssistantOpen(false)`；`sidePanel` 回退想法组件；若无可渲染内容则 `sidePanelOpen=false`，分栏 `collapse`。
4. **`thoughtPanelOpen`**：`thoughtDialogOpen || (thoughtListOpen && thoughtListCluster != null)`，避免 `thoughtListOpen` 悬空导致「标志开、内容空」。
5. **`sidePanelSlot`**：包一层 `key={assistant|thought-dialog|thought-list}` 强制切换时正确挂载。
6. **分栏组件**：`react-resizable-panels` v4 `collapsible` + `panelRef.collapse()`；关闭时同步 + 双 rAF 共**三帧** `setLayout({ reader:100, assistant:0 })`；`hidden` 且仅在 `sidePanelOpen` 时渲染 `border-l` 壳。
7. **关闭想法列表**：`closeThoughtList` 清空 `returnToListClusterRef`、`thoughtListCluster`，避免关闭后 effect 或悬空标志导致空白分栏。
8. **划线**：`onUserHighlightPopBar` / `openHighlightPopBarAtBookContent` 去掉 `setAssistantOpen(false)`，MK 可与 PopBar 并存。

---

## 4. 关键代码对比与注释

### 4.1 `openAssistant` / `toggleAssistant`（`read.tsx`）

**改动前** · 基线 HEAD（约 L1001–L1016）

```typescript
// 打开助手前先关掉想法列表与详情，导致分栏先收再开
const openAssistant = useCallback((draft?: string) => {
	setThoughtListOpen(false);
	setThoughtDialogOpen(false);
	if (draft?.trim()) {
		setAssistantInput(draft.trim());
	}
	setAssistantOpen(true);
}, []);

// 打开助手时同样关闭想法；关闭助手时不清理悬空 list open
const toggleAssistant = useCallback(() => {
	setAssistantOpen((prev) => {
		if (!prev) {
			setThoughtListOpen(false);
			setThoughtDialogOpen(false);
		}
		return !prev;
	});
}, []);
```

**改动后** · 当前（约 L1016–L1030）

```typescript
// 仅打开 MK 问书；想法 state 保留在后台，由 sidePanel 优先级决定显示谁
const openAssistant = useCallback((draft?: string) => {
	if (draft?.trim()) {
		setAssistantInput(draft.trim());
	}
	setAssistantOpen(true);
}, []);

// 顶栏 Bot 切换；关闭时若 list open 但无 cluster 则顺带清理悬空标志与 cluster
const toggleAssistant = useCallback(() => {
	setAssistantOpen((wasOpen) => {
		if (wasOpen && thoughtListOpen && !thoughtListClusterRef.current) {
			setThoughtListOpen(false);
			setThoughtListCluster(null);
		}
		return !wasOpen;
	});
}, [thoughtListOpen]);
```

**变更摘要**：去掉打开 MK 时关闭想法；关闭时清理无效 `thoughtListOpen`；避免想法列表→MK 闪烁。

---

### 4.2 想法侧栏 `onAskBook`（`read.tsx` · `thoughtListQuoteActions`）

**改动前** · 基线（约 L1147–L1150）

```typescript
			onAskBook: () => {
				setThoughtListOpen(false);
				window.setTimeout(() => openAssistantWithSelection(quote), 0);
			},
```

**改动后** · 当前（约 L1147–L1149）

```typescript
			onAskBook: () => {
				openAssistantWithSelection(quote);
			},
```

**变更摘要**：与 PopBar MK 问书一致，同一帧打开助手，分栏宽度不变。

---

### 4.3 `sidePanelOpen` 与 `sidePanelSlot`（`read.tsx`）

**改动前** · 基线（约 L1215–L1217）

```typescript
// 由布尔标志 OR 推导，可能与 sidePanel 实际内容不一致
const thoughtPanelOpen = thoughtListOpen || thoughtDialogOpen;
const sidePanelOpen = assistantOpen || thoughtPanelOpen;
```

**改动后** · 当前（约 L1215–L1325，摘录）

```typescript
// 想法面板：列表须有 cluster 才算真正打开
const thoughtPanelOpen =
	thoughtDialogOpen || (thoughtListOpen && thoughtListCluster != null);

// ... sidePanel useMemo 按优先级返回 EbookAssistant / EpubThought / EpubThoughtList ...

// 布局是否展开：与 state 标志对齐，避免 cluster 已空仍占位
const sidePanelOpen =
	assistantOpen ||
	thoughtDialogOpen ||
	(Boolean(thoughtListOpen) && thoughtListCluster != null);
// 切换 assistant / 想法时变更 key，保证子树正确挂载
const sidePanelSlotKey = assistantOpen
	? 'assistant'
	: thoughtDialogOpen
		? 'thought-dialog'
		: 'thought-list';
// 包一层 slot 传给 EbookReadSplitLayout
const sidePanelSlot =
	sidePanel != null ? (
		<div
			key={sidePanelSlotKey}
			className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
		>
			{sidePanel}
		</div>
	) : null;
```

**变更摘要**：`sidePanelOpen` 与布尔标志绑定，避免 `thoughtListOpen` 悬空或 cluster 已清时分栏仍展开。

---

### 4.4 `closeThoughtList`（`read.tsx`）

**改动前** · [epub-thought-list-delete-close.md](./epub-thought-list-delete-close.md) 基线（约 L169–L171）

```typescript
	const closeThoughtList = useCallback(() => {
		setThoughtListOpen(false);
		setThoughtListCluster(null);
	}, []);
```

**改动后** · `apps/frontend/src/views/ebook/read.tsx`（当前，约 L1230–L1234）

```typescript
	// 关闭想法列表：清快照 ref，防止关闭详情 effect 误恢复列表
	const closeThoughtList = useCallback(() => {
		returnToListClusterRef.current = null;
		setThoughtListOpen(false);
		setThoughtListCluster(null);
	}, []);
```

**变更摘要**：显式关闭列表时清空 `returnToListClusterRef`，避免后续 `thoughts` 更新触发恢复 effect 或留空白分栏。

---

### 4.5 `EbookReadSplitLayout` 收起逻辑

> **已 supersede**：三帧 `collapse` + `hidden` 方案仍偶发空白/延迟。当前实现见 **[epub-split-panel-collapse.md](./epub-split-panel-collapse.md)**（`applyClosedLayout`、`opacity-0`、`onLayoutChanged` 兜底）。下文保留历史对比供 diff 追溯。

**改动前** · 基线（约 L51–L62）

```typescript
	useEffect(() => {
		if (!sidePanelOpen) {
			panelGroupRef.current?.setLayout({ reader: 100, assistant: 0 });
		} else {
			panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
		}
		const raf = requestAnimationFrame(() => {
			notifyEbookSplitPanelResizeEnd();
		});
		return () => cancelAnimationFrame(raf);
	}, [sidePanelOpen]);
```

**改动后** · 当前（约 L56–L76）

```typescript
	useLayoutEffect(() => {
		if (!sidePanelOpen) {
			const collapse = () => {
				assistantPanelRef.current?.collapse();
				panelGroupRef.current?.setLayout({ reader: 100, assistant: 0 });
			};
			collapse();
			const raf = requestAnimationFrame(() => {
				collapse();
				notifyEbookSplitPanelResizeEnd();
			});
			return () => cancelAnimationFrame(raf);
		}
		if (assistantPanelRef.current?.isCollapsed()) {
			assistantPanelRef.current.expand();
		}
		panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
		const raf = requestAnimationFrame(() => {
			notifyEbookSplitPanelResizeEnd();
		});
		return () => cancelAnimationFrame(raf);
	}, [sidePanelOpen]);
```

**改动后** · 当前（约 L56–L127，摘录）

```typescript
	useLayoutEffect(() => {
		if (!sidePanelOpen) {
			const collapse = () => {
				assistantPanelRef.current?.collapse();
				panelGroupRef.current?.setLayout({ reader: 100, assistant: 0 });
			};
			collapse();
			let raf2 = 0;
			const raf1 = requestAnimationFrame(() => {
				collapse();
				raf2 = requestAnimationFrame(() => {
					collapse();
					notifyEbookSplitPanelResizeEnd();
				});
			});
			return () => {
				cancelAnimationFrame(raf1);
				cancelAnimationFrame(raf2);
			};
		}
		// ... expand 分支未改动（摘录） ...
	}, [sidePanelOpen]);

			<ResizablePanel
				id="assistant"
				panelRef={assistantPanelRef}
				collapsible
				collapsedSize={0}
				className={cn('min-h-0 min-w-0', !sidePanelOpen && 'hidden')}
			>
				{sidePanelOpen ? (
					<div className="border-theme/10 ... border-l ...">
						<div className="min-h-0 flex-1 overflow-hidden">{sidePanel}</div>
					</div>
				) : null}
			</ResizablePanel>
```

**变更摘要**：三帧 `collapse` + 面板 `hidden` + 仅在展开时渲染侧栏壳，修复关闭列表后右侧留白。

---

## 5. 兼容性与影响

- 打开想法详情/列表仍会 `setAssistantOpen(false)`（显式切到想法），与 MK 互斥展示不变。
- 键盘翻页仍判断 `assistantOpen || thoughtPanelOpen`。
- PDF 分栏仍仅用 `assistantOpen`，不受本次 EPUB 侧栏 slot 影响。

## 6. 回归建议

1. 仅 MK：开 → 关，右侧完全收起，阅读区全宽。
2. 想法列表 → MK → 关 MK，回到列表，无闪烁。
3. PopBar / 想法条 MK 问书，与顶栏行为一致。
4. MK 开着点用户划线，助手不收起。
5. 想法列表右上角关闭 → 阅读区全宽，无右侧空白列。
6. 想法列表删至 0 条仍按 [epub-thought-list-delete-close.md](./epub-thought-list-delete-close.md) 收起。

## 7. 相关源码路径

| 说明 | 路径 |
|------|------|
| 状态编排 | `apps/frontend/src/views/ebook/read.tsx` |
| 分栏布局 | `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx` |

---

（若与仓库最新源码不一致，以源码为准）
