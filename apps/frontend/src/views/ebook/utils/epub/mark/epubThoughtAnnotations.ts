import type { Rendition } from 'epubjs';
import type { EbookThought, EbookThoughtClickCluster } from '../../../types';
import { getEpubScrollContainer } from '../reader/epubScrolledNav';
import {
	collectLoadedSpineHints,
	type EpubIframeContents,
	extractCfiSpineHint,
	getRenditionContentsList,
	isDomRangeStrictlyContained,
	isQuoteStrictlyNested,
	normalizeCfiSpineHint,
	setSvgAttrIfChanged,
} from './epubMarkShared';
import {
	parseSvgMarkRect,
	readMarkSvgLineSegmentsFromRects,
	resolveCfiDomRange,
	resolveHighlightSvgLineSegments,
	resolveMarkSvgLineSegments,
	type SvgLineSegment,
} from './epubRangeGeometry';

/** marks-pane 内 SVG rect 的局部坐标（随滚动由 epub.js 同步更新，无需 getClientRects） */
export type SvgLocalRect = SvgLineSegment;

export type UserHighlightBlockerSource = {
	cfi: string;
	rects: SvgLocalRect[];
};

export { parseSvgMarkRect };

/**
 * EPUB 想法下划线点击事件处理器类型定义
 *
 * - onThoughtClick：点击某一条想法（下划线）时的事件回调，通常用于弹出该条想法详情、编辑等操作。
 * - onThoughtClusterClick：嵌套选区点击时触发，传递聚合后的想法簇（含最外层引用与全部分组）。
 */
export type EpubThoughtClickHandlers = {
	/**
	 * 点击单条想法时触发
	 * @param thought 当前点击的具体想法对象
	 */
	onThoughtClick: (thought: EbookThought) => void;
	/**
	 * 点击想法下划线时触发（含嵌套选区聚合）
	 * @param cluster 本次点击范围内的想法簇
	 */
	onThoughtClusterClick: (cluster: EbookThoughtClickCluster) => void;
};

export const EPUB_THOUGHT_UNDERLINE_CLASS = 'moke-epub-thought-ul';

const EPUB_THOUGHT_UNDERLINE_STYLE_ID = 'moke-epub-thought-ul-styles';
const THOUGHT_MARK_DATA_SHOW_LINE = 'showLine';
const THOUGHT_MARK_DATA_SHOW_LINE_ATTR = 'show-line';

/** 深色背景下也可见的琥珀色细虚线（本人） */
const THOUGHT_LINE_COLOR_OWN = '#d97706';
/** 他人 / 书主想法虚线 */
const THOUGHT_LINE_COLOR_FOREIGN = '#797673';
const THOUGHT_MARK_DATA_LINE_OWN = 'thoughtLineOwn';
const THOUGHT_MARK_DATA_LINE_OWN_ATTR = 'thought-line-own';
const THOUGHT_LINE_OPACITY = '0.55';
/** 下划线与文字底边的间距（px） */
const THOUGHT_LINE_OFFSET_PX = 1;
/** 虚线：短线长度、间隔 */
const THOUGHT_LINE_DASHARRAY = '1 6';

const EPUB_THOUGHT_UNDERLINE_CSS = `
g.${EPUB_THOUGHT_UNDERLINE_CLASS} > rect,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"] > rect {
	stroke: transparent !important;
	stroke-width: 0 !important;
	fill: currentColor !important;
	fill-opacity: 0.001 !important;
}
g.${EPUB_THOUGHT_UNDERLINE_CLASS} > line,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"] > line {
	stroke: ${THOUGHT_LINE_COLOR_OWN} !important;
	stroke-opacity: ${THOUGHT_LINE_OPACITY} !important;
	stroke-width: 1 !important;
	stroke-dasharray: ${THOUGHT_LINE_DASHARRAY} !important;
	stroke-linecap: round !important;
}
g.${EPUB_THOUGHT_UNDERLINE_CLASS}[data-${THOUGHT_MARK_DATA_LINE_OWN_ATTR}="0"] > line,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"][data-${THOUGHT_MARK_DATA_LINE_OWN_ATTR}="0"] > line,
g.${EPUB_THOUGHT_UNDERLINE_CLASS} > line.moke-epub-thought-ul-foreign,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"] > line.moke-epub-thought-ul-foreign {
	stroke: ${THOUGHT_LINE_COLOR_FOREIGN} !important;
}
g.${EPUB_THOUGHT_UNDERLINE_CLASS}[data-${THOUGHT_MARK_DATA_SHOW_LINE_ATTR}="0"] > line,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"][data-${THOUGHT_MARK_DATA_SHOW_LINE_ATTR}="0"] > line {
	stroke: transparent !important;
	stroke-opacity: 0 !important;
}
g.${EPUB_THOUGHT_UNDERLINE_CLASS} > line.moke-epub-thought-ul-suppressed,
g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"] > line.moke-epub-thought-ul-suppressed {
	stroke: transparent !important;
	stroke-opacity: 0 !important;
}
`;

/** epub.js 默认 merge 到 g 上；rect 继承后成虚线框，line 默认黑色在深色主题不可见 */
export const EPUB_THOUGHT_UNDERLINE_STYLES: Record<string, string> = {
	stroke: THOUGHT_LINE_COLOR_OWN,
	'stroke-opacity': THOUGHT_LINE_OPACITY,
	'stroke-width': '1',
	'stroke-dasharray': THOUGHT_LINE_DASHARRAY,
	'mix-blend-mode': 'normal',
};

/** 仅命中、不绘制可见线（被外层选区完全包含时） */
export const EPUB_THOUGHT_UNDERLINE_HIT_STYLES: Record<string, string> = {
	stroke: 'transparent',
	'stroke-opacity': '0',
	'stroke-width': '1',
	'stroke-dasharray': THOUGHT_LINE_DASHARRAY,
	'mix-blend-mode': 'normal',
};

/**
 * 确保 EPUB 想法下划线（underline）自定义样式已插入目标文档的 <head> 区域。
 *
 * 功能说明：
 * - 检查并插入唯一 style 标签：通过唯一 ID（EPUB_THOUGHT_UNDERLINE_STYLE_ID）在当前文档（默认为全局 document）中查找 <style> 节点；
 *   若找不到，则创建新的 <style>，设定 style.id，并插入文档 <head>。
 * - 始终同步最新样式：无论是否首次插入，每次都将样式内容覆盖为 EPUB_THOUGHT_UNDERLINE_CSS，确保下划线样式及时更新（如动态主题切换、运行时变更等场景）。
 *
 * @param doc 待操作的目标文档（默认为全局 document，可用于 iframe 内容文档）
 */
function ensureThoughtUnderlineStyles(doc: Document = document): void {
	const head = doc.head ?? doc.documentElement;
	if (!head) return;

	// 查找唯一标识的 <style> 标签，用于避免重复插入
	let style = doc.getElementById(
		EPUB_THOUGHT_UNDERLINE_STYLE_ID,
	) as HTMLStyleElement | null;
	if (!style) {
		// 若未找到，创建新的 <style> 节点并设定唯一 id，插入到 <head>
		style = doc.createElement('style');
		style.id = EPUB_THOUGHT_UNDERLINE_STYLE_ID;
		head.appendChild(style);
	}
	// 始终将样式内容设置为最新下划线样式，确保主题或配置变动时及时刷新
	style.textContent = EPUB_THOUGHT_UNDERLINE_CSS;
}

function patchAllThoughtUnderlineMarks(
	rend?: Rendition,
	options?: { viewportOnly?: boolean },
): void {
	const pinCfis = resolvePinnedCfis();
	const viewportOnly = options?.viewportOnly ?? false;
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}

	for (const doc of docs) {
		try {
			ensureThoughtUnderlineStyles(doc);
			patchThoughtUnderlineMarks(doc, rend, pinCfis, viewportOnly);
		} catch {
			// iframe 卸载或文档不可用时忽略
		}
	}
}

/** 将想法 mark 在 marks-pane 内按跨度排序（短选区在上层，便于点击） */
export function restackThoughtMarkGroups(rend?: Rendition): void {
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}

	for (const doc of docs) {
		try {
			for (const pane of doc.querySelectorAll('.marks-pane')) {
				const groups = [
					...pane.querySelectorAll(
						`g.${EPUB_THOUGHT_UNDERLINE_CLASS}, g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"]`,
					),
				] as SVGElement[];
				groups.sort((left, right) => {
					const leftCfi = left.dataset.epubcfi?.trim() ?? '';
					const rightCfi = right.dataset.epubcfi?.trim() ?? '';
					const leftOwn = isThoughtMarkLineOwn(leftCfi, left);
					const rightOwn = isThoughtMarkLineOwn(rightCfi, right);
					if (leftOwn !== rightOwn) return leftOwn ? 1 : -1;
					const spanDiff =
						thoughtMarkSpanLength(right) - thoughtMarkSpanLength(left);
					if (spanDiff !== 0) return spanDiff;
					return (
						(left.dataset.epubcfi?.length ?? 0) -
						(right.dataset.epubcfi?.length ?? 0)
					);
				});
				for (const group of groups) {
					pane.appendChild(group);
				}
			}
		} catch {
			// iframe 卸载时忽略
		}
	}
}

/** 由 epubUserHighlights 在 patch 前注入：用户划线 SVG 热区，用于扣减重叠的想法虚线段 */
let userHighlightBlockerSources: UserHighlightBlockerSource[] = [];

export function setUserHighlightBlockerSourcesForThoughtPatch(
	sources: UserHighlightBlockerSource[],
): void {
	userHighlightBlockerSources = sources;
}

/** 滚动/翻页后 patch 想法下划线 DOM，不重绘批注 */
export function patchEpubThoughtUnderlineMarks(
	rend?: Rendition,
	options?: { viewportOnly?: boolean },
): void {
	patchAllThoughtUnderlineMarks(rend, options);
}

/**
 * 修正 EPUB 想法下划线标记的 SVG 元素，补全下划线、适配样式、消除多余 rect。
 *
 * 设计目的：
 * - epub.js 默认使用 g > rect 绘制文本高亮，但我们的想法下划线需用 g > line 虚线渲染；
 * - 需将 rect 做透明处理，仅作为热点，无需参与显示，防止出现在深色/主题切换下出现杂色边框；
 * - line 需根据 rect 自动计算位置、宽度、样式（始终保持下划线紧贴正文）；
 * - 允许通过 data-THOUGHT_MARK_DATA_SHOW_LINE 控制线的可见（如遇选区包裹、需让交互层生效时可隐藏线）。
 *
 * @param root SVG DOM 根节点（默认 document，全局或 EPUB iframe 文档皆可）
 */
const THOUGHT_LINE_SEG_CLASS = 'moke-epub-thought-ul-seg';
const THOUGHT_LINE_SUPPRESSED_CLASS = 'moke-epub-thought-ul-suppressed';
const THOUGHT_LINE_FOREIGN_CLASS = 'moke-epub-thought-ul-foreign';

/** cfi → 是否本人想法（patch 时写入 data 属性；epub.js 自定义 data 不可靠） */
const thoughtLineOwnByCfi = new Map<string, boolean>();
const MIN_THOUGHT_LINE_SEGMENT_PX = 2;

const THOUGHT_MARK_SELECTOR = `g.${EPUB_THOUGHT_UNDERLINE_CLASS}, g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"]`;

/** 全书 CFI 组数超过此阈值时，仅对已加载 spine 章节 apply（避免换章全量 underline） */
const SPINE_SCOPED_APPLY_MIN_GROUPS = 35;
/** 当前章或全书想法较多时，按视口动态挂载 mark（类似微信读书） */
const VIEWPORT_APPLY_MIN_CHAPTER_CFIS = 8;
const VIEWPORT_APPLY_MIN_TOTAL_CFIS = 30;
const VIEWPORT_KEEP_MARGIN_FACTOR = 0.85;
const VIEWPORT_REMOVE_MARGIN_FACTOR = 1.7;

type ThoughtViewportBand = { top: number; bottom: number };

type ThoughtUnderlineApplyContext = {
	getThoughts: () => EbookThought[];
	appliedRef: Map<string, string>;
	getCurrentUserId: () => number;
	getPinnedCfis?: () => ReadonlySet<string>;
};

let thoughtUnderlineApplyContext: ThoughtUnderlineApplyContext | null = null;

/** sync / 本地新建后下一轮 apply 强制挂载的 CFI（无视视口裁剪） */
const ephemeralPinCfis = new Set<string>();

export function ephemeralPinThoughtCfis(cfis: Iterable<string>): void {
	ephemeralPinCfis.clear();
	for (const cfi of cfis) {
		const key = cfi.trim();
		if (key) ephemeralPinCfis.add(key);
	}
}

export function setThoughtUnderlineApplyContext(
	ctx: ThoughtUnderlineApplyContext | null,
): void {
	thoughtUnderlineApplyContext = ctx;
}

function shouldScopeThoughtApplyBySpine(
	cfiGroupCount: number,
	loadedSpines: Set<string>,
): boolean {
	return (
		cfiGroupCount >= SPINE_SCOPED_APPLY_MIN_GROUPS && loadedSpines.size > 0
	);
}

function thoughtSpineHint(cfiRange: string): string {
	return normalizeCfiSpineHint(extractCfiSpineHint(cfiRange));
}

function resolveThoughtViewportRoot(rend: Rendition): HTMLElement | null {
	const scroll = getEpubScrollContainer(rend);
	if (scroll) return scroll;
	for (const contents of getRenditionContentsList(rend)) {
		return contents.document.documentElement;
	}
	return null;
}

function readThoughtViewportBands(container: HTMLElement): {
	keep: ThoughtViewportBand;
	remove: ThoughtViewportBand;
} {
	const rect = container.getBoundingClientRect();
	const height = rect.height > 0 ? rect.height : window.innerHeight;
	const keepMargin = height * VIEWPORT_KEEP_MARGIN_FACTOR;
	const removeMargin = height * VIEWPORT_REMOVE_MARGIN_FACTOR;
	return {
		keep: { top: rect.top - keepMargin, bottom: rect.bottom + keepMargin },
		remove: {
			top: rect.top - removeMargin,
			bottom: rect.bottom + removeMargin,
		},
	};
}

function isClientRectInThoughtBand(
	rect: DOMRect,
	band: ThoughtViewportBand,
): boolean {
	return rect.bottom >= band.top && rect.top <= band.bottom;
}

function isThoughtMarkGroupInBand(
	groupEl: SVGElement,
	band: ThoughtViewportBand,
): boolean {
	for (const rect of groupEl.querySelectorAll('rect')) {
		if (isClientRectInThoughtBand(rect.getBoundingClientRect(), band)) {
			return true;
		}
	}
	return false;
}

function isCfiRangeInThoughtBand(
	rend: Rendition,
	cfiRange: string,
	band: ThoughtViewportBand,
): boolean {
	const range = resolveCfiDomRange(rend, cfiRange);
	if (!range) return true;
	const rects = range.getClientRects();
	// ponytail: 布局未就绪时 rects 为空，视为在带内并 apply，避免 sync 新增划线被误跳过
	if (rects.length === 0) return true;
	for (let index = 0; index < rects.length; index++) {
		if (isClientRectInThoughtBand(rects.item(index)!, band)) {
			return true;
		}
	}
	return false;
}

function shouldUseViewportThoughtApply(
	totalGroupCount: number,
	chapterGroupCount: number,
): boolean {
	return (
		totalGroupCount >= VIEWPORT_APPLY_MIN_TOTAL_CFIS ||
		chapterGroupCount >= VIEWPORT_APPLY_MIN_CHAPTER_CFIS
	);
}

function resolvePinnedCfis(
	options?: ApplyThoughtUnderlineOptions,
): Set<string> {
	const pins = new Set<string>();
	for (const cfi of options?.pinCfis ?? []) {
		const key = cfi.trim();
		if (key) pins.add(key);
	}
	const fromCtx = thoughtUnderlineApplyContext?.getPinnedCfis?.();
	if (fromCtx) {
		for (const cfi of fromCtx) {
			const key = cfi.trim();
			if (key) pins.add(key);
		}
	}
	for (const cfi of ephemeralPinCfis) {
		pins.add(cfi);
	}
	return pins;
}

function filterThoughtMarkGroupsForViewportPatch(
	groupEls: SVGElement[],
	rend: Rendition | undefined,
	pinCfis: Set<string>,
): SVGElement[] {
	if (!rend || groupEls.length === 0) return groupEls;
	const ctx = thoughtUnderlineApplyContext;
	if (!ctx) return groupEls;

	const thoughts = ctx.getThoughts();
	const scoped = filterThoughtsForAnnotationApply(rend, thoughts);
	const totalGroups = groupThoughtsByCfi(thoughts).size;
	const chapterGroups = groupThoughtsByCfi(scoped).size;
	if (!shouldUseViewportThoughtApply(totalGroups, chapterGroups)) {
		return groupEls;
	}

	const root = resolveThoughtViewportRoot(rend);
	if (!root) return groupEls;
	const { keep } = readThoughtViewportBands(root);
	return groupEls.filter((groupEl) => {
		const cfi = groupEl.dataset.epubcfi?.trim() ?? '';
		if (cfi && pinCfis.has(cfi)) return true;
		return isThoughtMarkGroupInBand(groupEl, keep);
	});
}

/** 滚动/换章：视口内增量 apply，视口外回收 mark */
export function refreshThoughtUnderlinesInViewport(rend: Rendition): void {
	const ctx = thoughtUnderlineApplyContext;
	if (!ctx) return;
	applyEpubThoughtUnderlines(
		rend,
		ctx.getThoughts(),
		ctx.appliedRef,
		ctx.getCurrentUserId(),
		{ reclaimOffViewportMarks: true },
	);
}

/** @deprecated 别名，滚动 patch 仍调用 */
export const refreshThoughtUnderlinesForLoadedSpines =
	refreshThoughtUnderlinesInViewport;

function buildPresentThoughtMarkCfis(rend: Rendition): Set<string> {
	const present = new Set<string>();
	for (const doc of iterThoughtUnderlineDocuments(rend)) {
		try {
			for (const group of doc.querySelectorAll(THOUGHT_MARK_SELECTOR)) {
				const cfi = (group as SVGElement).dataset.epubcfi?.trim();
				if (cfi) present.add(cfi);
			}
		} catch {
			// iframe 卸载时忽略
		}
	}
	return present;
}

function iterThoughtUnderlineDocuments(rend: Rendition): Document[] {
	const docs = new Set<Document>([document]);
	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document) docs.add(contents.document);
	}
	return [...docs];
}

/** appliedRef 有记录但 marks-pane 无对应 mark 时返回 false，迫使重 apply */
export function isThoughtUnderlineMarkPresent(
	rend: Rendition,
	cfiRange: string,
): boolean {
	const cfi = cfiRange.trim();
	if (!cfi) return false;
	for (const doc of iterThoughtUnderlineDocuments(rend)) {
		try {
			for (const group of doc.querySelectorAll(THOUGHT_MARK_SELECTOR)) {
				if ((group as SVGElement).dataset.epubcfi?.trim() === cfi) {
					return true;
				}
			}
		} catch {
			// iframe 卸载时忽略
		}
	}
	return false;
}

/** 跨 mark 叠层 CFI 投影缓存；滚动 patch 复用，thought/高亮 sync 时清空 */
const thoughtStackProjectionCache = new Map<string, SvgLineSegment[]>();

export function invalidateThoughtStackProjectionCache(): void {
	thoughtStackProjectionCache.clear();
}

function stackProjectionCacheKey(targetCfi: string, otherCfi: string): string {
	return `${targetCfi}\0${otherCfi}`;
}

function resolveStackProjectionSegments(
	rend: Rendition | undefined,
	targetGroup: SVGElement,
	targetCfi: string,
	otherCfi: string,
	otherGroup: SVGElement,
): SvgLineSegment[] {
	const otherKey = otherCfi.trim();
	if (!otherKey) return [];

	const cacheKey = stackProjectionCacheKey(targetCfi, otherKey);
	const cached = thoughtStackProjectionCache.get(cacheKey);
	if (cached) return cached;

	const segments =
		rend && otherKey
			? resolveHighlightSvgLineSegments(rend, targetGroup, otherKey)
			: readMarkSvgLineSegmentsFromRects(otherGroup);
	thoughtStackProjectionCache.set(cacheKey, segments);
	return segments;
}

export function invalidateAppliedThoughtUnderlinesMissingDom(
	rend: Rendition,
	appliedRef: Map<string, string>,
): void {
	const presentCfis = new Set<string>();
	for (const doc of iterThoughtUnderlineDocuments(rend)) {
		try {
			for (const group of doc.querySelectorAll(THOUGHT_MARK_SELECTOR)) {
				const cfi = (group as SVGElement).dataset.epubcfi?.trim();
				if (cfi) presentCfis.add(cfi);
			}
		} catch {
			// iframe 卸载时忽略
		}
	}
	for (const cfi of [...appliedRef.keys()]) {
		if (!presentCfis.has(cfi)) {
			appliedRef.delete(cfi);
			thoughtLineOwnByCfi.delete(cfi);
		}
	}
}

type ThoughtLineSegment = {
	x1: number;
	x2: number;
	y: number;
};

function horizontalSvgOverlap(
	thought: SvgLocalRect,
	blocker: SvgLocalRect,
): [number, number] | null {
	const thoughtBottom = thought.y + thought.height;
	const blockerBottom = blocker.y + blocker.height;
	if (thoughtBottom <= blocker.y + 0.5 || thought.y >= blockerBottom - 0.5) {
		return null;
	}
	const thoughtRight = thought.x + thought.width;
	const blockerRight = blocker.x + blocker.width;
	if (thoughtRight <= blocker.x + 0.5 || thought.x >= blockerRight - 0.5) {
		return null;
	}
	return [Math.max(thought.x, blocker.x), Math.min(thoughtRight, blockerRight)];
}

/** 仅保留与当前想法 mark rect 在 SVG 局部坐标下有交集的用户划线热区 */
function getHighlightBlockerRectsForThought(
	thoughtRect: SvgLocalRect,
	sources: UserHighlightBlockerSource[],
): SvgLocalRect[] {
	if (sources.length === 0) return [];

	const blockers: SvgLocalRect[] = [];
	for (const source of sources) {
		for (const rect of source.rects) {
			if (horizontalSvgOverlap(thoughtRect, rect)) {
				blockers.push(rect);
			}
		}
	}
	return blockers;
}

function mergeClosedIntervals(
	intervals: Array<[number, number]>,
): Array<[number, number]> {
	if (intervals.length === 0) return [];
	const sorted = [...intervals].sort((left, right) => left[0] - right[0]);
	const merged: Array<[number, number]> = [sorted[0]!];
	for (let i = 1; i < sorted.length; i++) {
		const current = sorted[i]!;
		const last = merged[merged.length - 1]!;
		if (current[0] <= last[1]) {
			last[1] = Math.max(last[1], current[1]);
		} else {
			merged.push(current);
		}
	}
	return merged;
}

/** 从 [start,end] 中减去用户划线占用的水平区间，得到可绘制想法虚线的片段 */
function subtractHorizontalIntervals(
	start: number,
	end: number,
	blockers: Array<[number, number]>,
): Array<[number, number]> {
	if (end - start < MIN_THOUGHT_LINE_SEGMENT_PX) return [];
	const merged = mergeClosedIntervals(blockers);
	const visible: Array<[number, number]> = [];
	let cursor = start;

	for (const [blockStart, blockEnd] of merged) {
		const clipStart = Math.max(blockStart, start);
		const clipEnd = Math.min(blockEnd, end);
		if (clipEnd <= start || clipStart >= end) continue;
		if (clipStart > cursor) {
			visible.push([cursor, clipStart]);
		}
		cursor = Math.max(cursor, clipEnd);
	}

	if (cursor < end) {
		visible.push([cursor, end]);
	}

	return visible.filter(
		([segmentStart, segmentEnd]) =>
			segmentEnd - segmentStart >= MIN_THOUGHT_LINE_SEGMENT_PX,
	);
}

function computeThoughtLineSegmentsNotOverlappingHighlights(
	thoughtRect: SvgLocalRect,
	blockers: SvgLocalRect[],
): ThoughtLineSegment[] {
	const localX = thoughtRect.x;
	const localY = thoughtRect.y;
	const localWidth = thoughtRect.width;
	const localHeight = thoughtRect.height;
	const lineY = localY + localHeight + THOUGHT_LINE_OFFSET_PX;
	const lineEnd = localX + localWidth;

	if (blockers.length === 0) {
		return [{ x1: localX, x2: lineEnd, y: lineY }];
	}

	const localBlockers = blockers
		.map((blocker) => horizontalSvgOverlap(thoughtRect, blocker))
		.filter((range): range is [number, number] => range !== null);

	if (localBlockers.length === 0) {
		return [{ x1: localX, x2: lineEnd, y: lineY }];
	}

	return subtractHorizontalIntervals(localX, lineEnd, localBlockers).map(
		([x1, x2]) => ({ x1, x2, y: lineY }),
	);
}

function hideThoughtUnderlineLine(line: SVGLineElement): void {
	line.classList.add(THOUGHT_LINE_SUPPRESSED_CLASS);
	line.setAttribute('stroke', 'transparent');
	line.setAttribute('stroke-opacity', '0');
}

function resolveThoughtLineColor(
	group: EbookThought[],
	currentUserId: number,
): string {
	return group.some((t) => t.userId === currentUserId)
		? THOUGHT_LINE_COLOR_OWN
		: THOUGHT_LINE_COLOR_FOREIGN;
}

function resolveMarkLineColor(groupEl: SVGElement, cfi: string): string {
	return isThoughtMarkLineOwn(cfi, groupEl)
		? THOUGHT_LINE_COLOR_OWN
		: THOUGHT_LINE_COLOR_FOREIGN;
}

function syncThoughtLineOwnMark(groupEl: SVGElement, cfi: string): boolean {
	const lineOwn = isThoughtMarkLineOwn(cfi, groupEl);
	const attr = lineOwn ? '1' : '0';
	if (groupEl.dataset[THOUGHT_MARK_DATA_LINE_OWN] !== attr) {
		groupEl.dataset[THOUGHT_MARK_DATA_LINE_OWN] = attr;
	}
	return lineOwn;
}

function applyVisibleThoughtUnderlineLine(
	line: SVGLineElement,
	segment: ThoughtLineSegment,
	groupEl: SVGElement,
	cfi: string,
): void {
	const lineOwn = syncThoughtLineOwnMark(groupEl, cfi);
	const color = resolveMarkLineColor(groupEl, cfi);
	line.classList.remove(THOUGHT_LINE_SUPPRESSED_CLASS);
	line.classList.toggle(THOUGHT_LINE_FOREIGN_CLASS, !lineOwn);
	line.setAttribute('x1', String(segment.x1));
	line.setAttribute('x2', String(segment.x2));
	line.setAttribute('y1', String(segment.y));
	line.setAttribute('y2', String(segment.y));
	line.setAttribute('stroke', color);
	line.setAttribute('stroke-opacity', THOUGHT_LINE_OPACITY);
	line.setAttribute('stroke-width', '1');
	line.setAttribute('stroke-dasharray', THOUGHT_LINE_DASHARRAY);
	line.setAttribute('stroke-linecap', 'round');
}

function syncThoughtMarkRects(
	group: SVGElement,
	segments: SvgLineSegment[],
): SVGRectElement[] {
	const existing = [...group.querySelectorAll('rect')].filter(
		(rect): rect is SVGRectElement => rect instanceof SVGRectElement,
	);
	if (segments.length === 0) {
		return existing;
	}

	const rects: SVGRectElement[] = [];

	for (let index = 0; index < segments.length; index++) {
		const segment = segments[index]!;
		let rect = existing[index];
		if (!rect) {
			rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			group.insertBefore(rect, group.firstChild);
		}
		setSvgAttrIfChanged(rect, 'x', String(segment.x));
		setSvgAttrIfChanged(rect, 'y', String(segment.y));
		setSvgAttrIfChanged(rect, 'width', String(segment.width));
		setSvgAttrIfChanged(rect, 'height', String(segment.height));
		rects.push(rect);
	}

	for (let index = segments.length; index < existing.length; index++) {
		existing[index]?.remove();
	}

	return rects;
}

type PreparedThoughtMark = {
	groupEl: SVGElement;
	showLine: boolean;
	cfi: string;
	span: number;
	rects: SVGRectElement[];
	lines: NodeListOf<Element>;
};

/** patch 阶段估算选区跨度，与 sortCfiGroupsForUnderlineStack 一致；用 rect 宽度避免 CFI→DOM */
function thoughtMarkSpanLength(groupEl: SVGElement): number {
	let widthSum = 0;
	for (const rect of groupEl.querySelectorAll('rect')) {
		const parsed = parseSvgMarkRect(rect as SVGRectElement);
		if (parsed) widthSum += parsed.width;
	}
	if (widthSum > 0) return widthSum;
	const cfi = groupEl.dataset.epubcfi?.trim() ?? '';
	return cfi.length;
}

function isThoughtMarkLineOwn(cfi: string, groupEl?: SVGElement): boolean {
	const fromMap = thoughtLineOwnByCfi.get(cfi);
	if (fromMap !== undefined) return fromMap;
	if (groupEl) {
		return groupEl.dataset[THOUGHT_MARK_DATA_LINE_OWN] !== '0';
	}
	return true;
}

function compareThoughtMarksForStacking(
	left: PreparedThoughtMark,
	right: PreparedThoughtMark,
): number {
	const leftOwn = isThoughtMarkLineOwn(left.cfi, left.groupEl);
	const rightOwn = isThoughtMarkLineOwn(right.cfi, right.groupEl);
	if (leftOwn !== rightOwn) return leftOwn ? 1 : -1;
	const spanDiff = right.span - left.span;
	if (spanDiff !== 0) return spanDiff;
	return left.cfi.length - right.cfi.length;
}

function buildThoughtMarkStackRank(
	prepared: PreparedThoughtMark[],
): Map<SVGElement, number> {
	const order = [...prepared].sort(compareThoughtMarksForStacking);
	const rankByGroup = new Map<SVGElement, number>();
	for (let index = 0; index < order.length; index++) {
		rankByGroup.set(order[index]!.groupEl, index);
	}
	return rankByGroup;
}

/** 预计算每个下层 mark 需扣减的更高叠层投影线段（CFI 解析每对只做一次） */
function buildHigherStackOverlaySegmentsByItem(
	prepared: PreparedThoughtMark[],
	rankByGroup: Map<SVGElement, number>,
	rend?: Rendition,
): Map<SVGElement, SvgLineSegment[]> {
	const segmentsByItem = new Map<SVGElement, SvgLineSegment[]>();

	for (const item of prepared) {
		const itemRank = rankByGroup.get(item.groupEl) ?? 0;
		const allSegments: SvgLineSegment[] = [];

		for (const other of prepared) {
			if (other.groupEl === item.groupEl) continue;
			const otherRank = rankByGroup.get(other.groupEl) ?? 0;
			if (otherRank <= itemRank) continue;

			allSegments.push(
				...resolveStackProjectionSegments(
					rend,
					item.groupEl,
					item.cfi,
					other.cfi,
					other.groupEl,
				),
			);
		}

		segmentsByItem.set(item.groupEl, allSegments);
	}

	return segmentsByItem;
}

function collectHigherStackOverlayBlockers(
	thoughtLocal: SvgLocalRect,
	higherStackSegments: SvgLineSegment[],
): SvgLocalRect[] {
	const blockers: SvgLocalRect[] = [];
	for (const seg of higherStackSegments) {
		if (horizontalSvgOverlap(thoughtLocal, seg)) {
			blockers.push(seg);
		}
	}
	return blockers;
}

function prepareThoughtUnderlineMark(
	groupEl: SVGElement,
	rend?: Rendition,
): PreparedThoughtMark {
	const showLine = groupEl.dataset[THOUGHT_MARK_DATA_SHOW_LINE] !== '0';
	const cfi = groupEl.dataset.epubcfi?.trim() ?? '';
	syncThoughtLineOwnMark(groupEl, cfi);

	groupEl.querySelectorAll(`line.${THOUGHT_LINE_SEG_CLASS}`).forEach((node) => {
		node.remove();
	});

	const segments = resolveMarkSvgLineSegments(rend, groupEl, cfi);
	const rects = syncThoughtMarkRects(groupEl, segments);
	const lines = groupEl.querySelectorAll('line');

	rects.forEach((rect) => {
		rect.setAttribute('stroke', 'transparent');
		rect.setAttribute('stroke-width', '0');
		rect.setAttribute('fill', 'currentColor');
		rect.setAttribute('fill-opacity', '0.001');
	});

	groupEl.style.pointerEvents = '';

	return {
		groupEl,
		showLine,
		cfi,
		span: thoughtMarkSpanLength(groupEl),
		rects,
		lines,
	};
}

function applyThoughtUnderlineLineSegments(
	item: PreparedThoughtMark,
	perRectSegments: ThoughtLineSegment[][],
): void {
	item.rects.forEach((_rect, index) => {
		const segments = perRectSegments[index] ?? [];
		const primaryLine = item.lines[index] as SVGLineElement | undefined;

		if (segments.length === 0) {
			if (primaryLine) hideThoughtUnderlineLine(primaryLine);
			return;
		}

		segments.forEach((segment, segmentIndex) => {
			let line = segmentIndex === 0 ? primaryLine : undefined;
			if (!line) {
				line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
				line.classList.add(THOUGHT_LINE_SEG_CLASS);
				item.groupEl.appendChild(line);
			}
			applyVisibleThoughtUnderlineLine(line, segment, item.groupEl, item.cfi);
		});
	});

	for (let index = item.rects.length; index < item.lines.length; index++) {
		hideThoughtUnderlineLine(item.lines[index] as SVGLineElement);
	}
}

function patchThoughtUnderlineMarks(
	root: ParentNode = document,
	rend?: Rendition,
	pinCfis: Set<string> = new Set(),
	viewportOnly = false,
): void {
	let groupEls = [
		...root.querySelectorAll(
			`g.${EPUB_THOUGHT_UNDERLINE_CLASS}, g[ref="${EPUB_THOUGHT_UNDERLINE_CLASS}"]`,
		),
	] as SVGElement[];
	if (groupEls.length === 0) return;

	if (viewportOnly) {
		groupEls = filterThoughtMarkGroupsForViewportPatch(groupEls, rend, pinCfis);
		if (groupEls.length === 0) return;
	}

	const prepared = groupEls.map((groupEl) =>
		prepareThoughtUnderlineMark(groupEl, rend),
	);
	const rankByGroup = buildThoughtMarkStackRank(prepared);
	const higherStackSegmentsByItem = buildHigherStackOverlaySegmentsByItem(
		prepared,
		rankByGroup,
		rend,
	);

	const lineSegmentsByGroup = new Map<SVGElement, ThoughtLineSegment[][]>();

	for (const item of prepared) {
		const perRectSegments: ThoughtLineSegment[][] = [];
		const higherStackSegments =
			higherStackSegmentsByItem.get(item.groupEl) ?? [];

		for (const rect of item.rects) {
			const thoughtLocal = parseSvgMarkRect(rect);
			if (!thoughtLocal) {
				perRectSegments.push([]);
				continue;
			}

			const userBlockers = getHighlightBlockerRectsForThought(
				thoughtLocal,
				userHighlightBlockerSources,
			);
			const stackBlockers = collectHigherStackOverlayBlockers(
				thoughtLocal,
				higherStackSegments,
			);
			const segments = item.showLine
				? computeThoughtLineSegmentsNotOverlappingHighlights(thoughtLocal, [
						...userBlockers,
						...stackBlockers,
					])
				: [];
			perRectSegments.push(segments);
		}

		lineSegmentsByGroup.set(item.groupEl, perRectSegments);
	}

	for (const item of prepared) {
		applyThoughtUnderlineLineSegments(
			item,
			lineSegmentsByGroup.get(item.groupEl) ?? [],
		);
	}
}

/**
 * 延迟两帧后为 EPUB 想法下划线 patch 样式与位置的调度函数
 *
 * 用途：
 * 为了解决 epub.js 内容渲染/切换时标记刷新可能与 DOM 更新存在时序差异，可能首帧拿到的 SVG 不完整或刚被重建，
 * 此处使用两级 requestAnimationFrame（rAF）的方式“延后两帧”，保证 DOM 状态稳定后再执行下划线相关样式插入与定制化 patch。
 *
 * 实现细节：
 * - 第一层 rAF：推迟到下一帧，使本轮微/宏任务后的 DOM 更新有机会完成（比如 React/epub.js 完成注入）。
 * - 第二层 rAF：再推迟一帧，进一步规避复杂 DOM 树在批量变化下可能的时间差，确保操作时 SVG 已经挂载且是最终形态。
 * - ensureThoughtUnderlineStyles()：注入自定义 CSS，仅插入一次。
 * - patchThoughtUnderlineMarks()：遍历所有 EPUB 想法下划线组件的 rect/line，定位和样式 patch。
 */

/**
 * EPUB 想法下划线 mark 的 SVG Selector
 *
 * 该选择器用于选中所有 epub.js 渲染的想法下划线（虚线），
 * 其 mark 可能以 class 或 ref 属性命中，兼容两种情况。
 *
 * - g.moke-epub-thought-ul            ：通过 class 选中
 * - g[ref="moke-epub-thought-ul"]     ：通过 ref 属性选中（某些 epub.js 版本 mark 时用 ref）
 */
function setThoughtMarkPointerEvents(value: 'none' | 'auto'): void {
	for (const selector of [THOUGHT_MARK_SELECTOR]) {
		document.querySelectorAll(selector).forEach((node) => {
			(node as SVGElement).style.pointerEvents = value;
		});
	}
}

/**
 * 获取指定 window 中当前被用户选中的文本内容
 *
 * @param win 目标 window（通常为 EPUB 阅读区中的 iframe window）
 * @returns 当前选中的文本内容（已去除首尾空白），若无选中文本则返回空字符串
 */
function readSelectionText(win: Window): string {
	// 通过 getSelection() 获得 Selection 对象（可能为 null），读取 toString() 结果再 trim 去除空白
	return (win.getSelection()?.toString() ?? '').trim();
}

/**
 * 判断 {@link Rendition} 当前各内容区（可能多 iframe）中是否存在任意文字选区
 *
 * 原理：遍历 rendition.getContents() 返回的内容对象列表，依次检查其 window 内是否有非空的选中文本
 * 只要有一个 iframe 存在选区即返回 true，所有为空则为 false
 *
 * @param rend EPUB.js 的 Rendition 实例
 * @returns 是否有任一内容区被选中文字（即用户正在选区阶段）
 */
export function hasTextSelectionInRend(rend: Rendition): boolean {
	const raw = rend.getContents();

	/**
	 * EPUB.js rendition.getContents() 可能返回：
	 *   - 单个 EpubIframeContents
	 *   - EpubIframeContents[]（多 iframe 章节并存情形）
	 *   - null/undefined（极端情况）
	 *
	 * 故此需规范化为数组结构，便于后续统一遍历
	 */
	const list: EpubIframeContents[] = Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];

	// 遍历所有内容 iframe，只要有 window 选区非空则视为“有选中文字”
	for (const contents of list) {
		if (readSelectionText(contents.window).length > 0) return true;
	}

	// 所有区块均未检测到选中文本，返回 false
	return false;
}

/**
 * [核心保护机制] 防止选中文字时误触 EPUB 想法 underline（虚线下划线）mark 的点击事件
 *
 * - 问题：用户在阅读区拖动鼠标/手指选中一段文字时，选区下方的“想法”虚线下划线区域（SVG 层）屏幕坐标重叠；
 *         若 mouseup(松手)/click 坐标刚好落在 mark 上，容易导致“想法详情弹窗”意外打开，产生误触。
 * - 目标：在选区开始（鼠标/触摸按下）阶段暂时关闭下划线的 pointer-events，待本轮点击事件全部派发结束（mouseup 后的 setTimeout）
 *         再恢复 pointer-events: auto，从而实现“选字不弹窗、正常点击依然可交互”。
 *
 * @param rend EPUB.js 的 Rendition 对象，用于注册/解绑内容 iframe 的相关事件
 * @returns dispose 函数，调用可彻底移除本 guard 绑定的一切监听与副作用，务必随页面卸载时一同释放
 */
function attachThoughtMarkClickGuard(rend: Rendition): () => void {
	// 记录所有已绑定 contents (iframe 渲染区) 及其解绑回调，方便整体注销
	const contentCleanups = new Map<EpubIframeContents, () => void>();

	/**
	 * 在 selection 编辑区内按下（mousedown/touchstart）时触发，此时关闭 underline mark 的 pointer-events，
	 * 让拖动和松手不会命中 SVG 下划线，防止 onClick/markClicked 被错误触发。
	 */
	const onSelectionPointerDown = () => {
		setThoughtMarkPointerEvents('none');
	};

	/**
	 * 在整个文档（顶层 window） pointerup/touchend 时恢复 pointer-events:auto，
	 * 注意需要 setTimeout 避免恢复过早导致 click/mouseup 派发时依然会命中 mark。
	 */
	const onSelectionPointerUp = () => {
		// setTimeout 0：等事件冒泡和 click 完全处理后再恢复（防止因事件顺序提前导致问题）
		setTimeout(() => setThoughtMarkPointerEvents('auto'), 0);
	};

	/**
	 * 绑定具体的 iframe contents —— 在其 document 上挂载 down 事件监听。
	 * 只有初次进入（未被记录）时才绑定一次，防止重复。
	 */
	const bindContents = (contents: EpubIframeContents) => {
		if (contentCleanups.has(contents)) return; // 避免重复注册
		const doc = contents.document;
		doc.addEventListener('mousedown', onSelectionPointerDown, true); // 捕获阶段监听鼠标按下
		doc.addEventListener('touchstart', onSelectionPointerDown, true); // 兼容触摸按下
		// 记录解绑函数，销毁时调用，避免内存泄漏或事件残留
		contentCleanups.set(contents, () => {
			doc.removeEventListener('mousedown', onSelectionPointerDown, true);
			doc.removeEventListener('touchstart', onSelectionPointerDown, true);
		});
	};

	// 注册 EPUB.js 渲染 iframe (contents) 动态载入钩子，每次有新 iframe 加载都会自动绑定事件
	rend.hooks.content.register(bindContents);

	// 对于当前已加载的 contents 也立刻补上一遍绑定（首次进页面就有 iframe 时需覆盖）
	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item as EpubIframeContents);
	} else if (existing) {
		bindContents(existing as EpubIframeContents);
	}

	// 在顶层文档全局监听 pointerup（鼠标松手）和 touchend（触摸释放），统一恢复 pointer-events，确保不漏
	document.addEventListener('pointerup', onSelectionPointerUp, true);
	document.addEventListener('touchend', onSelectionPointerUp, true);

	/**
	 * 返回一个卸载函数，调用后移除所有监听与副作用，包括所有 iframe 的事件和全局 pointerup/touchend，
	 * 并确保恢复 pointer-events:auto 强制回归可交互状态。
	 */
	return () => {
		try {
			rend.hooks.content.deregister(bindContents);
		} catch {
			// rendition 已销毁时忽略
		}
		for (const fn of contentCleanups.values()) fn(); // 调用所有解绑逻辑
		contentCleanups.clear();
		document.removeEventListener('pointerup', onSelectionPointerUp, true);
		document.removeEventListener('touchend', onSelectionPointerUp, true);
		setThoughtMarkPointerEvents('auto'); // 万一漏了恢复，强制兜底
	};
}

function groupThoughtsByCfi(
	thoughts: EbookThought[],
): Map<string, EbookThought[]> {
	const map = new Map<string, EbookThought[]>();
	for (const thought of thoughts) {
		const cfi = thought.cfiRange.trim(); // 去除两端空白防止意外失配
		if (!cfi) continue; // cfiRange 为空则跳过
		const list = map.get(cfi) ?? []; // 已有则取出当前分组，否则新建空数组
		list.push(thought); // 加入该段分组
		map.set(cfi, list); // 更新分组映射
	}
	return map;
}

/** 仅保留当前 rendition 已加载 spine 的想法（大书换章 apply 热路径） */
export function filterThoughtsForAnnotationApply(
	rend: Rendition,
	thoughts: EbookThought[],
): EbookThought[] {
	const grouped = groupThoughtsByCfi(thoughts);
	const loadedSpines = collectLoadedSpineHints(rend);
	if (!shouldScopeThoughtApplyBySpine(grouped.size, loadedSpines)) {
		return thoughts;
	}
	return thoughts.filter((thought) =>
		loadedSpines.has(thoughtSpineHint(thought.cfiRange)),
	);
}

/** 选区跨度（字符数）：用于重叠下划线叠放，短选区后绘制、位于上层以优先响应点击 */
function cfiGroupSpanLength(group: EbookThought[]): number {
	const quote = group[0]?.quote?.trim();
	if (quote && quote.length > 0) return quote.length;
	return group[0]?.cfiRange.length ?? 0;
}

function sortCfiGroupsForUnderlineStack(
	entries: [string, EbookThought[]][],
): [string, EbookThought[]][] {
	return [...entries].sort((a, b) => {
		const spanDiff = cfiGroupSpanLength(b[1]) - cfiGroupSpanLength(a[1]);
		if (spanDiff !== 0) return spanDiff;
		return a[0].length - b[0].length;
	});
}

/**
 * 判断 inner CFI 区间是否被 outer 区间“严格包含”（即 inner 是 outer 的严格子集，不能与 outer 完全重合）。
 *
 * 多步判断（兼容 DOM 可用与不可用场景）：
 * 1. 若 CFI 字符串相同，则肯定不严格包含，直接返回 false。
 * 2. 若渲染引擎 rend 能解析两段 CFI 的 DOM Range，则调用 isDomRangeStrictlyContained 严格比较物理区域是否嵌套。
 * 3. 若无法获得 DOM Range，则退化为摘录 quote 的内容判断：
 *    - 取每组 group 的第一个 thought 的 quote，修剪空白。
 *    - 若 inner quote 不是 outer quote 的严格子串（isQuoteStrictlyNested），说明无嵌套，返回 false。
 *    - 若 quote 严格嵌套，再判断二者的“spine hint”是否相同（即是否同章节），只在同章节下认为嵌套成立。
 *
 * 用于决定下划线关系：内层完全被外层包裹时优先只绘外层（避免多条重叠）。
 *
 * @param inner - 被检测是否嵌套的 CFI 字符串
 * @param outer - 外层 CFI 字符串
 * @param innerGroup - inner 关联的 thought 列表（首项的 quote 参与文本判定）
 * @param outerGroup - outer 关联的 thought 列表
 * @param rend - epub.js 渲染引擎，用于解析 CFI -> DOM 区间
 * @returns inner 是否被 outer 严格包含
 */
/** 判断 inner CFI 是否被 outer CFI 严格包含（供下划线 apply 与想法 cluster 复用） */
export function isThoughtCfiRangeStrictlyContained(
	inner: string,
	outer: string,
	innerGroup: EbookThought[],
	outerGroup: EbookThought[],
	rend: Rendition,
): boolean {
	return isCfiRangeStrictlyContained(
		inner,
		outer,
		innerGroup,
		outerGroup,
		rend,
	);
}

function isCfiRangeStrictlyContained(
	inner: string,
	outer: string,
	innerGroup: EbookThought[],
	outerGroup: EbookThought[],
	rend: Rendition,
): boolean {
	// 若 CFI 完全一致，不认为是嵌套，直接 false
	if (inner === outer) return false;

	// 尝试利用 Rendition 解析成 DOM Range 精确比较物理区域嵌套关系
	const innerRange = resolveCfiDomRange(rend, inner);
	const outerRange = resolveCfiDomRange(rend, outer);
	if (innerRange && outerRange) {
		// 可解析为 DOM 区间时，直接用 DOM API 判断是否严格包含
		return isDomRangeStrictlyContained(innerRange, outerRange);
	}

	// 不可解析 DOM 时，回退到文字摘录 quote 判断
	const innerQuote = innerGroup[0]?.quote?.trim() ?? '';
	const outerQuote = outerGroup[0]?.quote?.trim() ?? '';
	// 若摘录内容不满足“严格嵌套”，直接 false
	if (!isQuoteStrictlyNested(innerQuote, outerQuote)) return false;

	// quote 嵌套后，还需同章节（spine hint）才算“嵌套”
	return extractCfiSpineHint(inner) === extractCfiSpineHint(outer);
}

function buildThoughtUnderlineSignature(
	thoughtIds: string[],
	showLine: boolean,
): string {
	return `${showLine ? '1' : '0'}|${thoughtIds.join(',')}`;
}

export type ApplyThoughtUnderlineOptions = {
	/** 侧栏锚点 / 新建想法 / sync 等：无视视口裁剪强制挂载 */
	pinCfis?: Iterable<string>;
	/** 滚动停稳时回收视口外 mark；想法增删改时应为 false */
	reclaimOffViewportMarks?: boolean;
};

/**
 * 仅同步下划线批注（thoughts 变化时调用，不重复注册 hooks）
 * 大书：按视口动态挂载（keep 带内 apply，remove 带外回收），类似微信读书。
 */
export function applyEpubThoughtUnderlines(
	rend: Rendition,
	thoughts: EbookThought[],
	appliedRef: Map<string, string>,
	currentUserId = 0,
	options?: ApplyThoughtUnderlineOptions,
): void {
	try {
		ensureThoughtUnderlineStyles();
	} catch {
		ephemeralPinCfis.clear();
		return;
	}

	const pinCfis = resolvePinnedCfis(options);
	const scopedThoughts = filterThoughtsForAnnotationApply(rend, thoughts);
	const grouped = groupThoughtsByCfi(scopedThoughts);
	const allGrouped = groupThoughtsByCfi(thoughts);
	const loadedSpines = collectLoadedSpineHints(rend);
	const scopeBySpine = shouldScopeThoughtApplyBySpine(
		allGrouped.size,
		loadedSpines,
	);
	const viewportMode = shouldUseViewportThoughtApply(
		allGrouped.size,
		grouped.size,
	);
	const viewportRoot = viewportMode ? resolveThoughtViewportRoot(rend) : null;
	const viewportBands = viewportRoot
		? readThoughtViewportBands(viewportRoot)
		: null;

	const shouldKeepCfiApplied = (cfiRange: string): boolean => {
		if (pinCfis.has(cfiRange)) return true;
		if (!viewportMode || !viewportBands) return true;
		for (const doc of iterThoughtUnderlineDocuments(rend)) {
			try {
				for (const group of doc.querySelectorAll(THOUGHT_MARK_SELECTOR)) {
					if ((group as SVGElement).dataset.epubcfi?.trim() !== cfiRange) {
						continue;
					}
					return isThoughtMarkGroupInBand(
						group as SVGElement,
						viewportBands.remove,
					);
				}
			} catch {
				// ignore
			}
		}
		return isCfiRangeInThoughtBand(rend, cfiRange, viewportBands.keep);
	};

	const presentCfis = buildPresentThoughtMarkCfis(rend);
	const nextCfis = new Set(grouped.keys());

	for (const [cfiRange, group] of grouped) {
		thoughtLineOwnByCfi.set(
			cfiRange,
			group.some((t) => t.userId === currentUserId),
		);
	}
	for (const key of [...thoughtLineOwnByCfi.keys()]) {
		if (!nextCfis.has(key)) thoughtLineOwnByCfi.delete(key);
	}

	for (const cfiRange of [...appliedRef.keys()]) {
		const dropData =
			!nextCfis.has(cfiRange) ||
			(scopeBySpine && !loadedSpines.has(thoughtSpineHint(cfiRange)));
		const dropViewport =
			Boolean(options?.reclaimOffViewportMarks) &&
			viewportMode &&
			!shouldKeepCfiApplied(cfiRange);
		if (!dropData && !dropViewport) continue;
		if (pinCfis.has(cfiRange) && dropViewport && nextCfis.has(cfiRange)) {
			continue;
		}
		try {
			rend.annotations.remove(cfiRange, 'underline');
		} catch {
			// ignore
		}
		appliedRef.delete(cfiRange);
	}

	const sortedEntries = sortCfiGroupsForUnderlineStack([...grouped.entries()]);

	for (const [cfiRange, group] of sortedEntries) {
		if (viewportMode && !pinCfis.has(cfiRange) && viewportBands) {
			if (!isCfiRangeInThoughtBand(rend, cfiRange, viewportBands.keep)) {
				continue;
			}
		}

		const thoughtIds = group.map((t) => t.id);
		const showLine = true;
		const lineOwn = group.some((t) => t.userId === currentUserId);
		const nextSig = `${buildThoughtUnderlineSignature(thoughtIds, showLine)}|${lineOwn ? '1' : '0'}`;
		if (appliedRef.get(cfiRange) === nextSig && presentCfis.has(cfiRange)) {
			continue;
		}

		try {
			rend.annotations.remove(cfiRange, 'underline');
			rend.annotations.underline(
				cfiRange,
				{
					thoughtIds,
					[THOUGHT_MARK_DATA_SHOW_LINE]: showLine ? '1' : '0',
					[THOUGHT_MARK_DATA_LINE_OWN]: lineOwn ? '1' : '0',
				},
				undefined,
				EPUB_THOUGHT_UNDERLINE_CLASS,
				{
					...EPUB_THOUGHT_UNDERLINE_STYLES,
					stroke: resolveThoughtLineColor(group, currentUserId),
				},
			);
			appliedRef.set(cfiRange, nextSig);
			presentCfis.add(cfiRange);
		} catch {
			appliedRef.delete(cfiRange);
		}
	}
	ephemeralPinCfis.clear();
}

/** 移除当前 appliedRef 中记录的全部下划线 */
export function teardownAppliedThoughtUnderlines(
	rend: Rendition,
	appliedRef: Map<string, string>,
): void {
	for (const cfiRange of [...appliedRef.keys()]) {
		thoughtLineOwnByCfi.delete(cfiRange);
		try {
			rend.annotations.remove(cfiRange, 'underline');
		} catch {
			// rendition 可能已销毁
		}
	}
	appliedRef.clear();
}

export type EpubThoughtUnderlineListenerOptions = EpubThoughtClickHandlers & {
	getThoughts: () => EbookThought[];
};

/**
 * 安装下划线交互监听（样式 patch 由 installEpubUserHighlightPatchListeners 统一处理）
 */
export function installEpubThoughtUnderlineListeners(
	rend: Rendition,
	_options?: EpubThoughtUnderlineListenerOptions,
): () => void {
	void _options;
	const detachMarkClickGuard = attachThoughtMarkClickGuard(rend);

	return () => {
		detachMarkClickGuard();
	};
}

/**
 * @deprecated 请改用 applyEpubThoughtUnderlines + installEpubThoughtUnderlineListeners
 */
export function syncEpubThoughtUnderlines(
	rend: Rendition,
	thoughts: EbookThought[],
	handlers: EpubThoughtClickHandlers,
	/** cfiRange -> 该段下所有 thoughtId（顺序与 thoughts 一致） */
	appliedRef: Map<string, string>,
): () => void {
	const getThoughtsRef = { current: thoughts };
	getThoughtsRef.current = thoughts;

	applyEpubThoughtUnderlines(rend, thoughts, appliedRef);
	const detachListeners = installEpubThoughtUnderlineListeners(rend, {
		...handlers,
		getThoughts: () => getThoughtsRef.current,
	});

	return () => {
		detachListeners();
		teardownAppliedThoughtUnderlines(rend, appliedRef);
	};
}
