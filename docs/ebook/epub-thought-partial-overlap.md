# EPUB 想法虚线：部分重叠选区去重

## 文档角色

**增量专题**：修复两次「写想法」选区**部分相交**（非严格嵌套）时，重叠段琥珀虚线**双线叠加**变粗的问题。

**延伸阅读**：[epub-thought-underline-impl.md](./epub-thought-underline-impl.md)（想法虚线主文档）、[epub-user-highlight-impl.md](./epub-user-highlight-impl.md)（用户划线重叠合并与 blocker 机制）、[epub-reading-thoughts.md](./epub-reading-thoughts.md)（数据层与嵌套去重）。

---

## 1. 背景与目标

### 1.1 用户可见问题

同一段正文先后写两条想法，若两次选区**有交集但不互为包含**（例如前一次选半句、后一次选整句且与前段重叠），重叠区域会出现**两条琥珀虚线叠在一起**，dash 相位错位，视觉上像「加粗、发虚的双线」。

### 1.2 目标

- 重叠水平区间**只画一条**可见虚线。
- **不合并**数据库中的两条 `ebook_thought` 记录（点击较短选区仍打开对应列表）。
- **不影响**用户彩色划线（合并、删除、PopBar 逻辑保持不变）。
- **保留**既有严格嵌套去重（大段包小段只外层画线）。

---

## 2. 改动范围

| 路径 | 说明 |
|------|------|
| `apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts` | `patchThoughtUnderlineMarks` 两阶段绘制 + 想法间 blocker |

本轮**未改**后端、想法 API、`applyEpubThoughtUnderlines` 的嵌套判定、用户划线 `coalesceOverlappingHighlightsForRender`。

---

## 3. 实现思路

### 3.1 根因

想法虚线有两层去重：

| 层级 | 机制 | 覆盖场景 |
|------|------|----------|
| **apply** | `computeLineVisibleCfis` + `isCfiRangeStrictlyContained` | 严格嵌套：内层 `showLine=0`，只留透明热区 |
| **patch** | `computeThoughtLineSegmentsNotOverlappingHighlights` | 与用户划线 SVG rect 求交，扣掉被彩色块盖住的线段 |

**缺口**：部分相交时两个 CFI 均 `showLine=1`，patch 阶段未扣减**其它想法 mark** 已占用的水平区间 → 重叠段各画一条 `<line>`。

用户划线在 **apply 前**用 `coalesceOverlappingHighlightsForRender` 把相交选区合成一条再画；想法不能合并数据，应在 **patch** 用与用户划线相同的 **blocker 区间减法**。

### 3.2 方案（patch 阶段 blocker）

1. **Prepare**：遍历所有 `g.moke-epub-thought-ul`，同步 rect、读 `data-show-line`。
2. **排序**：与 `sortCfiGroupsForUnderlineStack` 一致——**较长选区先画**（`span` 优先 quote 字符数，否则 rect 宽度之和）。
3. **按序扣线**：对每个 `showLine=1` 的 mark，blockers = **用户划线 blocker**（`userHighlightBlockerSources`，由 `syncEpubReadingAnnotations` 注入）∪ **已绘制想法线段 blocker**（`thoughtLineBlockerSources`）。
4. **登记**：本 mark 实际画出的线段写入 `thoughtLineBlockerSources`，供更短/后处理的 mark 扣减。
5. **Apply**：按 DOM 原顺序把算好的线段写回 `<line>`；透明 `rect` 热区不变，点击行为不变。

### 3.3 为何不合并 CFI / 不改 apply

- 合并 CFI 会破坏「点短选区 → 只出该段想法列表」的产品规则。
- 严格嵌套已由 `computeLineVisibleCfis` 处理；部分重叠只需 patch 层线段切分，与「虚线被用户高亮盖住」同一套 `subtractHorizontalIntervals` 数学。

### 3.4 与用户划线的关系

- 用户 blocker **先**参与扣减（彩色高亮仍优先盖住虚线）。
- 想法 blocker **只登记实际可见线段**，避免「长线因用户高亮未画出却挡住短线」的误挡。
- `epubUserHighlights.ts` 中 `setUserHighlightBlockerSourcesForThoughtPatch` 调用顺序未变。

---

## 4. 关键代码与注释

### 4.1 两阶段 patch 与想法 blocker 累积

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`patchThoughtUnderlineMarks`，约 L530–L595）

```typescript
function patchThoughtUnderlineMarks(
	root: ParentNode = document,
	rend?: Rendition,
): void {
	// 说明：收集当前文档内全部想法 underline 的 g 节点
	const groupEls = [
		...root.querySelectorAll(
			`g.${EPUB_THOUGHT_UNDERLINE_CLASS}, g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"]`,
		),
	] as SVGElement[];
	if (groupEls.length === 0) return;

	// 说明：第一阶段——同步 rect/样式，并算出每个 mark 的 span（用于绘制顺序）
	const prepared = groupEls.map((groupEl) =>
		prepareThoughtUnderlineMark(groupEl, rend),
	);

	// 说明：已绘制想法虚线的水平区间，供后续较短 mark 扣减（类比用户划线的 coalesce 视觉效果）
	const thoughtLineBlockerSources: UserHighlightBlockerSource[] = [];
	const lineSegmentsByGroup = new Map<SVGElement, ThoughtLineSegment[][]>();
	// 说明：较长选区先占线，与 apply 时 sortCfiGroupsForUnderlineStack 一致
	const drawOrder = [...prepared].sort(compareThoughtMarksForLineDrawOrder);

	for (const item of drawOrder) {
		const perRectSegments: ThoughtLineSegment[][] = [];

		for (const rect of item.rects) {
			const thoughtLocal = parseSvgMarkRect(rect);
			if (!thoughtLocal) {
				perRectSegments.push([]);
				continue;
			}

			// 说明：用户彩色划线占用的 SVG 热区（sync 前由 epubUserHighlights 注入）
			const userBlockers = getHighlightBlockerRectsForThought(
				thoughtLocal,
				userHighlightBlockerSources,
			);
			// 说明：其它想法 mark 已画出的虚线段
			const thoughtBlockers = getHighlightBlockerRectsForThought(
				thoughtLocal,
				thoughtLineBlockerSources,
			);
			const segments = item.showLine
				? computeThoughtLineSegmentsNotOverlappingHighlights(thoughtLocal, [
						...userBlockers,
						...thoughtBlockers,
					])
				: [];
			perRectSegments.push(segments);

			// 说明：仅登记「本 mark 实际画出来」的线段，避免空挡误挡后续 mark
			if (item.showLine && segments.length > 0) {
				appendThoughtLineBlockerRects(
					thoughtLineBlockerSources,
					item.cfi,
					thoughtLocal,
					segments,
				);
			}
		}

		lineSegmentsByGroup.set(item.groupEl, perRectSegments);
	}

	// 说明：第二阶段——按 DOM 顺序写回 line，不改变 mark 叠放与 pointer-events
	for (const item of prepared) {
		applyThoughtUnderlineLineSegments(
			item,
			lineSegmentsByGroup.get(item.groupEl) ?? [],
		);
	}
}
```

### 4.2 绘制顺序与 blocker 登记

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`compareThoughtMarksForLineDrawOrder`、`appendThoughtLineBlockerRects`，约 L436–L465）

```typescript
/** 将已绘制的想法虚线段登记为 blocker，供较短/后绘制的重叠选区扣减 */
function appendThoughtLineBlockerRects(
	sources: UserHighlightBlockerSource[],
	cfi: string,
	thoughtRect: SvgLocalRect,
	segments: ThoughtLineSegment[],
): void {
	const rects = segments
		.map((segment) => ({
			x: segment.x1,
			y: thoughtRect.y,
			width: segment.x2 - segment.x1,
			height: thoughtRect.height,
		}))
		.filter((rect) => rect.width >= MIN_THOUGHT_LINE_SEGMENT_PX);
	if (rects.length === 0) return;
	sources.push({ cfi, rects });
}

function compareThoughtMarksForLineDrawOrder(
	left: PreparedThoughtMark,
	right: PreparedThoughtMark,
): number {
	if (!left.showLine && !right.showLine) return 0;
	if (!left.showLine) return 1; // 说明：仅命中、不画线的内层 mark 不参与占线
	if (!right.showLine) return -1;
	const spanDiff = right.span - left.span; // 说明：长选区优先
	if (spanDiff !== 0) return spanDiff;
	return left.cfi.length - right.cfi.length; // 说明：同 span 时 CFI 短者优先（稳定 tie-break）
}
```

### 4.3 水平区间减法（与用户划线共用）

**来源**：`apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts`（`computeThoughtLineSegmentsNotOverlappingHighlights`，约 L330–L356）

```typescript
function computeThoughtLineSegmentsNotOverlappingHighlights(
	thoughtRect: SvgLocalRect,
	blockers: SvgLocalRect[],
): ThoughtLineSegment[] {
	const localX = thoughtRect.x;
	const lineY = thoughtRect.y + thoughtRect.height + THOUGHT_LINE_OFFSET_PX;
	const lineEnd = localX + thoughtRect.width;

	if (blockers.length === 0) {
		return [{ x1: localX, x2: lineEnd, y: lineY }];
	}

	// 说明：把 blocker 投影到与 thought rect 同行的水平区间 [x1,x2]
	const localBlockers = blockers
		.map((blocker) => horizontalSvgOverlap(thoughtRect, blocker))
		.filter((range): range is [number, number] => range !== null);

	return subtractHorizontalIntervals(localX, lineEnd, localBlockers).map(
		([x1, x2]) => ({ x1, x2, y: lineY }),
	);
}
```

---

## 5. 兼容性与影响

| 项 | 说明 |
|----|------|
| 数据层 | 仍是一条 thought 一条 CFI；无 API / 表结构变化 |
| 严格嵌套 | 仍由 `computeLineVisibleCfis` 控制内层 `showLine=0` |
| 部分重叠 | 重叠段只一条虚线；非重叠段各自保留虚线 |
| 点击 | 透明 `rect` 未缩短；短选区仍在上层（apply 叠放顺序不变） |
| 用户划线 | blocker 注入顺序与 `syncEpubReadingAnnotations` 不变 |
| 滚动/翻页 | `patchEpubThoughtUnderlineMarks(rend)` 每次重算 blocker，不依赖 stale 状态 |

---

## 6. 建议回归

1. **部分重叠**：同句先选前半再选整句（或反向）写两条想法 → 重叠段**一条**虚线，非重叠段各有一段线。
2. **严格嵌套**：「黑美人」与「傻皇帝与黑美人」→ 仍仅外层一条可见线；点「黑美人」出短列表。
3. **用户高亮 + 想法**：彩色高亮盖住段内虚线 → 删除高亮后虚线恢复；与重叠修复同时存在时不双线。
4. **点击**：重叠处点击仍按叠放命中较短 mark（与修复前一致）。
5. **滚动/切章**：翻页后 patch 重跑，重叠段仍单线。

---

## 7. 相关源码路径

| 说明 | 路径 |
|------|------|
| 想法 patch 与 blocker | `apps/frontend/src/views/ebook/utils/epubThoughtAnnotations.ts` |
| 用户 blocker 注入 | `apps/frontend/src/views/ebook/utils/epubUserHighlights.ts`（`syncEpubReadingAnnotations`、`collectUserHighlightBlockerSources`） |
| 统一 sync 入口 | `apps/frontend/src/views/ebook/components/EpubPane.tsx` |

若与仓库最新源码不一致，以源码为准。
