# EPUB 读书想法：右侧分栏面板

## 文档角色

**当前 UI 主文档**：在 [epub-reading-thoughts.md](./epub-reading-thoughts.md) 数据与下划线能力之上，读书想法 **列表 / 详情 / 写想法** 均位于 **阅读页右侧分栏**，与 **MK 问书（MOKE 助手）互斥共用同一栏位**（`EbookReadSplitLayout` + Resizable）。

> 全屏底部 **Sheet 抽屉**方案已废弃，组件自仓库删除；仅作历史说明见 [epub-thought-drawer.md](./epub-thought-drawer.md)（归档，勿按此文实现）。

**延伸阅读**：[epub-reading-thoughts.md](./epub-reading-thoughts.md)（API、下划线、重叠去重）、[epub-thought-cluster-bridging.md](./epub-thought-cluster-bridging.md)（**点击聚合 / 桥接规则**，列表引用区与分组展示）、[epub-thought-list-ui.md](./epub-thought-list-ui.md)（**列表单击进详情**、分组摘录展开、clamp 复用）、[epub-thought-quote-highlight-toggle.md](./epub-thought-quote-highlight-toggle.md)（引用区划线覆盖度）、[epub-split-soft-resize.md](./epub-split-soft-resize.md)（分栏软重排）、[epub-selection-popbar-visual.md](./epub-selection-popbar-visual.md)（选区浮动条视觉）、[epub-thought-underlines-sync.md](./epub-thought-underlines-sync.md)（下划线同步）、[ebook-moke-assistant.md](./ebook-moke-assistant.md)（右侧助手分栏）。

---

## 1. 背景与目标

- 早期 **Model 弹窗** 与中期 **全屏底部 Sheet 抽屉**（见归档 [epub-thought-drawer.md](./epub-thought-drawer.md)）均会大面积遮挡阅读区，或与「左读 + 右助手」布局不一致。
- 写想法时长输入区与外层滚动嵌套，易出现光标与滚轮异常；本轮在 **右侧面板 footer 固定 `ChatTextArea`**，滚动区只承载引用与只读详情。
- 用户在 **A 段列表** 时选 **B 段** 写想法并保存后，列表仍显示 A 段内容（`returnToListCfiRef` 与 `thoughtListGroup` 未同步）。

目标：与 MOKE 助手 **同一 Resizable 分栏** 承载读书想法；打开想法时自动关闭助手，反之亦然；保留 `returnToListCfiRef` 列表回退语义；写/编辑时 **输入区固定在面板 footer**。

---

## 2. 改动范围

| 区域 | 路径 |
|------|------|
| 分栏壳（泛化） | `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx` |
| 阅读页编排 | `apps/frontend/src/views/ebook/read.tsx` |
| 想法详情 | `apps/frontend/src/views/ebook/components/EpubThought.tsx` |
| 想法列表 | `apps/frontend/src/views/ebook/components/EpubThoughtList.tsx` |
| 面板壳 / 卡片片段 | `EpubThoughtPanelShell.tsx`、`EpubThoughtParts.tsx` |
| 引用操作条 | `EpubQuoteActionBar.tsx` |
| 选区浮动条 | `EpubSelectionPopBar.tsx`、`utils/epubSelectionToolbarAttach.ts` |
| 输入组件 | `apps/frontend/src/components/design/ChatTextArea/index.tsx` |
| **已删除（历史 UI）** | `EpubThoughtDialog.tsx`、`EpubThoughtListDialog.tsx`、`EpubThoughtBottomSheet.tsx`、`EpubThoughtDrawerParts.tsx` |

---

## 3. 实现思路

1. **分栏泛化**：`EbookReadSplitLayout` 不再硬编码 `EbookAssistant`，改为 `sidePanelOpen` + `sidePanel: ReactNode`，由 `read.tsx` 注入助手或想法面板。
2. **互斥编排**：`sidePanelOpen = assistantOpen || thoughtListOpen || thoughtDialogOpen`；打开想法时 `setAssistantOpen(false)`；打开助手时关闭想法列表/详情。
3. **sidePanel 优先级**：助手 > 想法详情/写想法 > 想法列表（同一时刻只渲染一种）。
4. **面板结构**：`EpubThoughtPanelShell` 提供顶栏关闭、滚动区与可选 **footer**；写/编辑时 `ChatTextArea` 放在 footer 的 `EpubThoughtComposeCard` 内（固定高度 `h-28`，按钮在边框内底部），上方滚动区仅展示引用卡片（查看模式含详情卡片）。
5. **列表回退**：从列表进详情时 `returnToListCfiRef = thought.cfiRange`；关闭详情回到同 CFI 列表。新建想法前写入 `returnToListCfiRef` 并 `setThoughtListOpen(false)`，避免列表仍绑旧段。
6. **保存后列表**：create 成功后按新 `cfiRange` 过滤 `thoughtListGroup` 并 `setThoughtListOpen(true)`，清空 `returnToListCfiRef`。
7. **scrollToComposeKey**：写想法页内引用区再点「写想法」时递增 key，触发 `EpubThought` 内 focus + 滚底。
8. **选区工具条**：`EpubPane` 挂载 `attachEpubSelectionPopBar`；打开想法/列表/右键菜单时关闭浮动条，避免与面板重叠。视觉层（毛玻璃、箭头、阴影）见 **[epub-selection-popbar-visual.md](./epub-selection-popbar-visual.md)**。

---

## 4. 关键代码与注释

### 4.1 分栏泛化

**来源**：`apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx`（约 L7–L75）

```tsx
export type EbookReadSplitLayoutProps = {
	/** 右侧分栏是否展开（MOKE 助手或读书想法） */
	sidePanelOpen: boolean;
	sidePanel: ReactNode;
	children: ReactNode;
};

/**
 * 左阅读、右 MOKE 助手 / 读书想法（互斥，同栏位）。
 * 关闭时不挂载 sidePanel，避免 0 高度容器内 ChatEntry 抖动。
 */
export function EbookReadSplitLayout({ sidePanelOpen, sidePanel, children }: EbookReadSplitLayoutProps) {
	// sidePanelOpen 为 false 时 reader 占 100%，assistant 面板 minSize=0 且 pointer-events-none
	// ...
	{sidePanelOpen ? sidePanel : null}
}
```

### 4.2 阅读页 sidePanel 与互斥

**来源**：`apps/frontend/src/views/ebook/read.tsx`（约 L604–L685、L1168–L1192）

```tsx
const thoughtPanelOpen = thoughtListOpen || thoughtDialogOpen;
const sidePanelOpen = assistantOpen || thoughtPanelOpen;

const sidePanel = useMemo(() => {
	if (!book) return null;
	// 优先级 1：MK 问书助手
	if (assistantOpen) {
		return <EbookAssistant bookId={book.id} /* ... */ />;
	}
	// 优先级 2：写想法 / 查看 / 编辑
	if (thoughtDialogOpen) {
		return (
			<EpubThought
				scrollToComposeKey={thoughtComposeScrollKey}
				mode={thoughtDialogMode}
				/* quote、content、onSave、quoteActions 等 */
			/>
		);
	}
	// 优先级 3：同段想法列表
	if (thoughtListOpen) {
		return (
			<EpubThoughtList
				thoughts={thoughtListGroup}
				onSelect={(thought) => openViewThought(thought, true)}
				quoteActions={thoughtListQuoteActions}
			/>
		);
	}
	return null;
}, [/* ... */]);

// EPUB 阅读区：keyboardNavEnabled 在任一侧栏打开时关闭，避免快捷键与输入冲突
<EbookReadSplitLayout sidePanelOpen={sidePanelOpen} sidePanel={sidePanel}>
	<EpubPane
		onSelectionPopBar={onSelectionPopBarChange}
		thoughts={thoughts}
		onThoughtGroupClick={openThoughtGroup}
	/>
</EbookReadSplitLayout>
```

### 4.3 新建想法与保存后列表同步

**来源**：`apps/frontend/src/views/ebook/read.tsx`（`openCreateThought`、`saveThought` 附近）

```tsx
const openCreateThought = useCallback((quote: string, cfiRange?: string) => {
	// ...
	setAssistantOpen(false);
	returnToListCfiRef.current = cfiRange; // 关闭写想法页时回到「当前引用段」列表
	setThoughtListOpen(false); // 避免仍显示上一段列表
	setThoughtDialogMode('create');
	setThoughtDialogOpen(true);
	setThoughtComposeScrollKey((key) => key + 1);
}, [t]);

// saveThought（create 分支）
setThoughts((prev) => {
	const updated = [item, ...prev];
	// 保存后立即切到新 CFI 下的列表，而非旧 thoughtListGroup
	setThoughtListGroup(updated.filter((t) => t.cfiRange === item.cfiRange));
	return updated;
});
setThoughtListOpen(true);
returnToListCfiRef.current = null;
```

### 4.4 详情面板：footer 固定输入

**来源**：`apps/frontend/src/views/ebook/components/EpubThought.tsx`（约 L87–L136）

```tsx
<EpubThoughtPanelShell
	ref={scrollRef}
	footer={
		readOnly ? undefined : (
			<EpubThoughtComposeCard
				actions={
					<>
						<Button size="sm" variant="outline" onClick={onClose}>取消</Button>
						<Button size="sm" onClick={() => void onSave()}>保存</Button>
					</>
				}
			>
				<ChatTextArea
					ref={textareaRef}
					input={content}
					setInput={onContentChange}
					sendMessage={handleSaveFromKeyboard} // Enter 保存
					className="h-full max-h-none border-0 px-3 pt-3"
					textareaClassName={THOUGHT_TEXTAREA_CLASS} // field-sizing-fixed
				/>
			</EpubThoughtComposeCard>
		)
	}
>
	{/* 滚动区：引用卡片 +（查看模式）详情卡片 */}
	<EpubThoughtQuoteCard quote={quote} quoteActions={quoteActions} />
	{readOnly ? <EpubThoughtItemCard /* 头像、正文、删除/编辑 */ /> : null}
</EpubThoughtPanelShell>
```

---

## 5. 兼容性与影响

- **破坏性**：已删除 Model 弹窗、全屏 BottomSheet 及 `EpubThoughtDrawerParts`；当前仅保留分栏内 `EpubThought*` + `EpubThoughtPanelShell` / `EpubThoughtParts`。
- **PDF**：读书想法仍仅 EPUB；PDF 分栏仍只挂载 MOKE 助手。
- **行为保持**：下划线点击仍先开列表；`returnToListClusterRef` 回退逻辑与早期弹窗/抽屉轮次一致，并修复跨段列表错位。
- **点击聚合（2026-06-22）**：列表由 `EbookThoughtClickCluster` 驱动（`thoughtListCluster`），不再按单一 CFI 分组 `thoughtListGroup` 打开。嵌套选区、相邻短语桥接、引用区切换等规则见 **[epub-thought-cluster-bridging.md](./epub-thought-cluster-bridging.md)**（主文档）；本节 §4 代码摘录中若仍出现 `thoughtListGroup`，以 cluster 实现为准。

---

## 6. 风险与回归

- 打开想法 → 关闭 → 再打开 MK 问书，分栏宽度是否恢复上次拖拽比例。
- A 段列表 → 选 B 段写想法 → 保存 → 应显示 B 段列表。
- 嵌套选区（整段 + 子句）点击任一处 → 引用区默认整段、列表含全部相关想法（见 [epub-thought-cluster-bridging.md](./epub-thought-cluster-bridging.md) §9）。
- 写想法页引用区再点「写想法」：输入框应聚焦并滚到底。
- 侧栏打开时 EPUB 翻页快捷键应禁用；关闭后恢复。
- 选区浮动条与右侧面板、右键菜单不应同时遮挡。

---

## 7. 相关源码路径

| 说明 | 路径 |
|------|------|
| 编排入口 | `apps/frontend/src/views/ebook/read.tsx` |
| 分栏布局 | `apps/frontend/src/views/ebook/components/EbookReadSplitLayout.tsx` |
| 想法 UI | `apps/frontend/src/views/ebook/components/EpubThought.tsx`、`EpubThoughtList.tsx`、`EpubThoughtPanelShell.tsx`、`EpubThoughtParts.tsx` |

若与仓库最新源码不一致，以源码为准。
