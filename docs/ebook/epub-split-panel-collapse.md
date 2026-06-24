# EPUB 阅读分栏：关闭侧栏后左侧全宽恢复

## 文档角色

**增量专题**：修复关闭 **读书想法列表**（或右侧分栏整体收起）后，左侧阅读区 **偶发仍占约 58% 宽**、右侧留 **空白列**，以及 **延迟数帧才恢复全宽** 的问题。根因在 `react-resizable-panels` 与 `display: none` / 多帧 `rAF` 的交互，而非想法业务 state。

**延伸阅读**：[epub-side-panel-moke.md](./epub-side-panel-moke.md)（MK 与想法分栏 state）、[epub-split-soft-resize.md](./epub-split-soft-resize.md)（拖拽 soft resize）、[epub-thought-quote-viewport.md](./epub-thought-quote-viewport.md)（分栏 resize 后引用 scroll 校正）。

> [epub-side-panel-moke.md](./epub-side-panel-moke.md) §4.5 曾描述「双/三帧 collapse」方案；**以本文为准**。

---

## 1. 背景与目标

### 1.1 现象

| 现象 | 用户感知 |
|------|----------|
| 点想法列表右上角关闭 | 右侧约 42% 空白，左侧未占满 |
| 偶发 | 同上，需再拖分栏或刷新才恢复 |
| 即使最终恢复 | 左侧 **卡顿 1～2 帧** 才变全宽 |

### 1.2 根因

1. **`hidden`（`display: none`）** 加在右侧 `ResizablePanel` 上时，面板脱离布局度量，`collapse()` / `setLayout({ reader: 100, assistant: 0 })` **经常无效**，分组仍按 58/42 分配。
2. **三重 `requestAnimationFrame`** 才 `notifyEbookSplitPanelResizeEnd`：可见延迟；effect cleanup 还可能 **取消最后一帧**，导致偶发没收干净。
3. **`onLayoutChanged` 闭包** 使用 render 时的 `sidePanelOpen`，与异步 layout 回调可能 **不同步**，无法在侧栏已关时二次纠正。

### 1.3 目标

- 关闭侧栏后 **同步** 将 layout 设为 `{ reader: 100, assistant: 0 }`（对齐 Monaco `edit` 模式）。
- 右栏用 **`opacity-0` + `pointer-events-none`** 隐藏，不用 `hidden`。
- **单帧** 补刀 + EPUB resize 通知；`onLayoutChanged` **兜底** 强制收栏。

---

## 2. 改动范围

| 路径 | 说明 |
|------|------|
| `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx` | `applyClosedLayout`、`sidePanelOpenRef`、收起 effect、layout 兜底、右栏 className |

---

## 3. 实现思路

1. **`CLOSED_LAYOUT` 常量**：`{ reader: 100, assistant: 0 }`，与 Monaco 收起右栏一致。
2. **`applyClosedLayout()`**：`assistantPanelRef.collapse()` + `panelGroupRef.setLayout(CLOSED_LAYOUT)`，供 effect 与 `onLayoutChanged` 共用。
3. **`useLayoutEffect`**：`!sidePanelOpen` 时 **同步** 调用一次，**单 rAF** 再调一次并 `notifyEbookSplitPanelResizeEnd`（取代三帧）。
4. **`sidePanelOpenRef`**：在 `onLayoutChanged` 中读最新开关；若已关但 `layout.assistant > 0`，再 `applyClosedLayout()`。
5. **右栏样式**：`hidden` → `opacity-0 pointer-events-none overflow-hidden`，面板仍在 DOM 布局树内，imperative API 可工作。

---

## 4. 关键代码对比与注释

### 4.1 `applyClosedLayout` 与 `CLOSED_LAYOUT`（纯新增）

**对比范围**：基线无此符号；改动后为新增常量与回调。

**改动前** · `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx`（基线 HEAD）

```typescript
// 基线无 CLOSED_LAYOUT 常量
// 基线无 applyClosedLayout；收起逻辑内联于 useLayoutEffect 的 collapse 闭包
```

**改动后** · `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx`（当前，约 L27–L54）

```typescript
// 侧栏完全收起时的 panel 百分比布局
const CLOSED_LAYOUT: Layout = { reader: 100, assistant: 0 };

// ... EbookReadSplitLayout 函数体开头 refs ...

// 与 sidePanelOpen 同步的 ref，供 onLayoutChanged 读最新值
const sidePanelOpenRef = useRef(sidePanelOpen);
// 每次 render 更新 ref，避免 layout 回调闭包陈旧
sidePanelOpenRef.current = sidePanelOpen;

// 收起右侧分栏并让左侧占满（同步调用，对齐 Monaco edit 模式）
const applyClosedLayout = useCallback(() => {
	// 先 collapse 可折叠 panel，再命令式 setLayout
	assistantPanelRef.current?.collapse();
	// 强制 reader 100%、assistant 0%
	panelGroupRef.current?.setLayout(CLOSED_LAYOUT);
}, []);
```

**变更摘要**：抽出可复用的收起入口，供 effect 与 layout 兜底共用。

---

### 4.2 `useLayoutEffect`（`sidePanelOpen` 分支）

**对比范围**：`useLayoutEffect` 完整依赖 `[sidePanelOpen, applyClosedLayout]` 的 effect 回调（关闭 + 展开两分支）。

**改动前** · `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx`（基线 HEAD，约 L56–L84）

```typescript
// 分栏开闭时同步 layout（基线）
useLayoutEffect(() => {
	// 侧栏应关闭
	if (!sidePanelOpen) {
		// 内联收起：collapse + setLayout
		const collapse = () => {
			assistantPanelRef.current?.collapse();
			panelGroupRef.current?.setLayout({ reader: 100, assistant: 0 });
		};
		// 同步执行一次
		collapse();
		// 第一帧 rAF
		let raf2 = 0;
		const raf1 = requestAnimationFrame(() => {
			collapse();
			// 第二帧 rAF 才 notify
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
	// 侧栏应打开：若 panel 已 collapse 则 expand
	if (assistantPanelRef.current?.isCollapsed()) {
		assistantPanelRef.current.expand();
	}
	// 恢复上次拖拽比例
	panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
	const raf = requestAnimationFrame(() => {
		notifyEbookSplitPanelResizeEnd();
	});
	return () => cancelAnimationFrame(raf);
}, [sidePanelOpen]);
```

**改动后** · `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx`（当前，约 L66–L84）

```typescript
// 分栏开闭时同步 layout（当前）
useLayoutEffect(() => {
	// 侧栏应关闭
	if (!sidePanelOpen) {
		// 同步收起，避免首帧仍显示 58/42
		applyClosedLayout();
		// 单帧补刀 + 通知 EPUB soft resize；勿用 hidden 藏 panel
		const raf = requestAnimationFrame(() => {
			applyClosedLayout();
			notifyEbookSplitPanelResizeEnd();
		});
		return () => cancelAnimationFrame(raf);
	}
	// 侧栏应打开
	if (assistantPanelRef.current?.isCollapsed()) {
		assistantPanelRef.current.expand();
	}
	panelGroupRef.current?.setLayout(lastSplitLayoutRef.current);
	const raf = requestAnimationFrame(() => {
		notifyEbookSplitPanelResizeEnd();
	});
	return () => cancelAnimationFrame(raf);
}, [sidePanelOpen, applyClosedLayout]);
```

**变更摘要**：三帧 rAF 改为同步 + 单帧；依赖增加 `applyClosedLayout`。

---

### 4.3 `onLayoutChanged` 兜底

**对比范围**：`ResizablePanelGroup` 的 `onLayoutChanged` 回调属性。

**改动前** · 基线 HEAD（约 L92–L95）

```typescript
			onLayoutChanged={(layout) => {
				// 仅侧栏打开时记忆用户拖拽比例
				if (sidePanelOpen) lastSplitLayoutRef.current = layout;
				// 结束分栏指针拖拽
				finishSplitPointerDrag();
			}}
```

**改动后** · 当前（约 L92–L99）

```typescript
			onLayoutChanged={(layout) => {
				// 侧栏打开：记录 layout 供下次展开
				if (sidePanelOpenRef.current) {
					lastSplitLayoutRef.current = layout;
				// 侧栏已关但 assistant 仍 > 0：强制再收（兜底偶发未 collapse）
				} else if ((layout.assistant ?? 0) > 0) {
					applyClosedLayout();
				}
				finishSplitPointerDrag();
			}}
```

**变更摘要**：用 ref 读最新 `sidePanelOpen`；关闭态下 layout 泄漏时二次 `applyClosedLayout`。

---

### 4.4 右侧 `ResizablePanel` className

**对比范围**：assistant `ResizablePanel` 的 `className` 属性。

**改动前** · 基线 HEAD（约 L120）

```typescript
				className={cn('min-h-0 min-w-0', !sidePanelOpen && 'hidden')}
```

**改动后** · 当前（约 L124–L127）

```typescript
				className={cn(
					'min-h-0 min-w-0 overflow-hidden',
					!sidePanelOpen && 'pointer-events-none opacity-0',
				)}
```

**变更摘要**：`hidden` 改为透明 + 禁指针，保留 panel 在布局树内以便 `collapse`/`setLayout` 生效（与 Monaco 右栏 `opacity-0` 策略一致）。

---

## 5. 兼容性与影响

| 项 | 说明 |
|----|------|
| 打开侧栏 | 仍 `expand` + `lastSplitLayoutRef` 恢复比例 |
| EPUB resize | 仍经 `notifyEbookSplitPanelResizeEnd` → `EpubPane.settleHostResize` |
| PDF / MK | 同一 `EbookReadSplitLayout`，关闭路径均受益 |
| 性能 | 少 2 帧 rAF，收起更快 |

---

## 6. 回归建议

1. 打开想法列表 → 右上角关闭 → **立即** 全宽，无右侧空白。
2. 反复开/关列表 10 次，无偶发 58% 宽。
3. 列表 → 详情 → 关详情回列表 → 关列表 → 全宽。
4. 开 MK → 关 MK；开列表 → 开 MK → 关 MK（应回想法面板）。
5. 关闭后 EPUB 引用段仍可见（与 [epub-thought-quote-viewport.md](./epub-thought-quote-viewport.md) 叠加）。

---

## 7. 相关源码路径

| 说明 | 路径 |
|------|------|
| 分栏布局 | `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx` |
| resize 通知 | `apps/frontend/src/views/ebook/utils/ebookSplitResize.ts` |
| sidePanelOpen 推导 | `apps/frontend/src/views/ebook/read.tsx` |
| Monaco 参考 | `apps/frontend/src/components/design/Monaco/index.tsx`（`setLayout({ editor: 100, right: 0 })`） |

---

（若与仓库最新源码不一致，以源码为准）
