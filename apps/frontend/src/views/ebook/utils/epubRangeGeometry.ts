/**
 * 本文件负责实现 EPUB 阅读器中与 CFI（EPUB 坐标）与 DOM 区间（Range）互相定位、映射及可视区域计算等相关的核心工具函数。
 *
 * 主要实现逻辑和能力如下：
 *
 * 1. CFI 与 Range 的双向解析与缓存
 *    - 提供根据 CFI 字符串解析出对应 DOM Range 的高性能工具，并支持 sync 阶段缓存，加速高频查找与高亮定位。
 *    - 支持根据 DOM Range 反推 EPUB CFI 区间，保证多 iframe、跨章节的范围都能严格按 EPUB 标准可定位与恢复。
 *
 * 2. 精确坐标与高亮区块计算
 *    - 实现了多场景下区分每一行文本的 getAccurateRangeLineClientRects，支持多容器、跨行的精准可视范围检测。
 *    - 对高亮或遮罩覆盖应用需求场景做了针对性优化（如：与用户手动选区、TTS 切句的区域精确对齐）。
 *
 * 3. 选区 Range 规范化处理
 *    - 提供 normalizeSelectionRangeForEpub 工具，对任意选区严格规范化，避免选区因 DOM 结构或空白影响 CFI 生成与后续恢复。
 *
 * 4. 利用多级缓存提升性能
 *    - 针对高频操作场景，利用缓存（如 syncAccurateClientRectCache、syncCfiRangeCache）显著减少重复 DOM/CFI 解析，保障交互丝滑。
 *    - 兼容多 iframe、章节并发处理，健壮性与性能兼备。
 *
 * 5. 其他辅助操作
 *    - 提供 Range 边界裁剪、逐字精确步进、遍历范围文本节点等基础能力，统一服务于高亮、注释、听读等外围功能。
 *
 * 适用场景涵盖：高亮渲染、注释业务、朗读高亮、区域同步、跨章节/跨 iframe 定位与 UI 覆盖等 EPUB 阅读核心复杂交互需求。
 */
import type { Rendition } from 'epubjs';
import {
	type EpubIframeContents,
	getRenditionContentsList,
} from './epubMarkShared';

export type { EpubIframeContents };
export { getRenditionContentsList };

export const EPUB_ANNOTATION_IGNORE_CLASS = 'epubjs-hl';

export type EpubRenditionView = {
	index?: number;
	contents?: { document?: Document };
};

/** epub.js views() 返回 Views 集合对象，须 .all() 展开为数组 */
export function getRenditionViewsList(rend?: Rendition): EpubRenditionView[] {
	if (!rend) return [];
	const raw = rend.views();
	if (!raw) return [];
	if (Array.isArray(raw)) return raw as EpubRenditionView[];
	return (raw as { all?: () => EpubRenditionView[] }).all?.() ?? [];
}

const TRIM_BOUNDARY_MAX_STEPS = 8192;

function trimBoundary(range: Range, fromStart: boolean): void {
	let steps = 0;
	while (steps++ < TRIM_BOUNDARY_MAX_STEPS) {
		const text = range.toString();
		if (!text) return;

		const edge = fromStart ? text[0] : text.at(-1);
		if (!edge || !/\s/u.test(edge)) return;

		if (!stepRangeBoundary(range, fromStart)) return;
	}
}

function stepRangeBoundary(range: Range, forward: boolean): boolean {
	const container = forward ? range.startContainer : range.endContainer;
	const offset = forward ? range.startOffset : range.endOffset;

	if (container.nodeType === Node.TEXT_NODE) {
		const content = container.textContent ?? '';
		if (forward) {
			if (offset >= content.length) return false;
			range.setStart(container, offset + 1);
			return true;
		}
		if (offset <= 0) return false;
		range.setEnd(container, offset - 1);
		return true;
	}

	if (container.nodeType !== Node.ELEMENT_NODE) return false;

	const doc = container.ownerDocument;
	if (!doc) return false;

	const probe = doc.createRange();
	if (forward) {
		if (offset >= container.childNodes.length) return false;
		probe.setStart(container, offset);
		probe.setEnd(container, offset + 1);
		probe.collapse(true);
		range.setStart(probe.startContainer, probe.startOffset);
		return true;
	}

	if (offset <= 0) return false;
	probe.setStart(container, offset - 1);
	probe.setEnd(container, offset);
	probe.collapse(false);
	range.setEnd(probe.endContainer, probe.endOffset);
	return true;
}

/** 去掉选区首尾空白，避免 CFI 比视觉选区更宽 */
export function trimSelectionRange(range: Range): Range {
	const trimmed = range.cloneRange();
	trimBoundary(trimmed, true);
	trimBoundary(trimmed, false);
	return trimmed;
}

/** 文档序下一节点（深度优先） */
function nextNodeInDocumentOrder(node: Node): Node | null {
	if (node.firstChild) return node.firstChild;
	let current: Node | null = node;
	while (current) {
		if (current.nextSibling) return current.nextSibling;
		current = current.parentNode;
	}
	return null;
}

function getFirstNodeInRange(range: Range): Node | null {
	const { startContainer, startOffset } = range;
	if (startContainer.nodeType === Node.TEXT_NODE) {
		return startContainer;
	}
	const child = startContainer.childNodes[startOffset];
	if (child) return child;
	if (startOffset > 0) {
		const prev = startContainer.childNodes[startOffset - 1];
		if (prev) return nextNodeInDocumentOrder(prev);
	}
	return nextNodeInDocumentOrder(startContainer);
}

function isNodeAfterRangeEnd(node: Node, range: Range): boolean {
	const end = range.endContainer;
	if (node === end) return false;
	return Boolean(
		end.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
	);
}

/** 沿文档序遍历 Range 内文本节点（O(选区跨度)，避免章级 TreeWalker + intersectsNode） */
export function forEachTextNodeInRange(
	range: Range,
	visit: (node: Text, start: number, end: number) => void,
): void {
	const endContainer = range.endContainer;
	const endOffset = range.endOffset;

	let current: Node | null = getFirstNodeInRange(range);

	while (current) {
		if (current.nodeType === Node.TEXT_NODE) {
			const textNode = current as Text;
			const start = current === range.startContainer ? range.startOffset : 0;
			const end = current === range.endContainer ? endOffset : textNode.length;
			if (start < end) {
				visit(textNode, start, end);
			}
		}

		if (current === endContainer) break;

		const next = nextNodeInDocumentOrder(current);
		if (!next || isNodeAfterRangeEnd(next, range)) break;
		current = next;
	}
}

/**
 * 将选区收拢到首尾非空白字符，跳过空行/块级边界。
 * 反向拖选到空行时 Range 的 commonAncestor 常升到章容器，不可再用整棵 TreeWalker。
 */
export function snapSelectionRangeToTextContent(range: Range): Range | null {
	const doc = range.startContainer.ownerDocument;
	if (!doc) return null;

	let firstNode: Text | null = null;
	let firstOffset = 0;
	let lastNode: Text | null = null;
	let lastOffset = 0;

	forEachTextNodeInRange(range, (node, start, end) => {
		for (let offset = start; offset < end; offset++) {
			const ch = node.data[offset];
			if (!ch || /\s/u.test(ch)) continue;
			if (!firstNode) {
				firstNode = node;
				firstOffset = offset;
			}
			lastNode = node;
			lastOffset = offset + 1;
		}
	});

	if (!firstNode || !lastNode) return null;

	const snapped = doc.createRange();
	snapped.setStart(firstNode, firstOffset);
	snapped.setEnd(lastNode, lastOffset);
	return snapped;
}

/** 规范化文字选区：收拢正文边界并去掉首尾空白，供 CFI / PopBar 使用 */
export function normalizeSelectionRangeForEpub(range: Range): Range | null {
	const snapped = snapSelectionRangeToTextContent(range);
	if (!snapped) return null;
	const trimmed = trimSelectionRange(snapped);
	if (!trimmed.toString().trim()) return null;
	return trimmed;
}

function getCaretClientRect(range: Range): DOMRect | null {
	const rects = [...range.getClientRects()].filter(
		(r) => r.width > 0.5 || r.height > 0.5,
	);
	if (rects.length > 0) return rects[0] ?? null;
	const box = range.getBoundingClientRect();
	if (box.width > 0 || box.height > 0) return box;
	return null;
}

function sameLine(a: DOMRect, b: DOMRect): boolean {
	return Math.abs(a.top - b.top) < 1 && Math.abs(a.bottom - b.bottom) < 1;
}

function containsClientRect(outer: DOMRect, inner: DOMRect): boolean {
	return (
		inner.left >= outer.left - 0.5 &&
		inner.right <= outer.right + 0.5 &&
		inner.top >= outer.top - 0.5 &&
		inner.bottom <= outer.bottom + 0.5 &&
		!(
			Math.abs(inner.left - outer.left) < 0.5 &&
			Math.abs(inner.right - outer.right) < 0.5 &&
			Math.abs(inner.top - outer.top) < 0.5 &&
			Math.abs(inner.bottom - outer.bottom) < 0.5
		)
	);
}

function containsNonWhitespaceText(
	node: Text,
	start: number,
	end: number,
): boolean {
	for (let i = start; i < end; i++) {
		const ch = node.data[i];
		if (ch && !/\s/u.test(ch)) return true;
	}
	return false;
}

/** 去掉 marks-pane 会误删的「大行块 rect」，保留逐行 client rect */
function preferLeafLineClientRects(rects: DOMRect[]): DOMRect[] {
	if (rects.length <= 1) return rects;
	return rects.filter((rect, index) => {
		for (let i = 0; i < rects.length; i++) {
			if (i === index) continue;
			if (containsClientRect(rect, rects[i]!)) {
				return false;
			}
		}
		return true;
	});
}

/** 按 range 内各文本节点片段取 client rect，避免整行/block 宽度误命中行尾空白 */
function collectRangeTextClientRects(range: Range): DOMRect[] {
	const doc = range.startContainer.ownerDocument;
	if (!doc) return [];

	const rects: DOMRect[] = [];

	forEachTextNodeInRange(range, (node, start, end) => {
		if (!containsNonWhitespaceText(node, start, end)) return;

		const segment = doc.createRange();
		segment.setStart(node, start);
		segment.setEnd(node, end);
		for (const rect of segment.getClientRects()) {
			if (rect.width > 0.5 && rect.height > 0.5) {
				rects.push(rect);
			}
		}
	});

	return preferLeafLineClientRects(rects);
}

function pointInTextBandRect(
	rect: DOMRect,
	clientX: number,
	clientY: number,
	maxBelowPx: number,
): boolean {
	return (
		clientY >= rect.top &&
		clientY < rect.top + rect.height + maxBelowPx &&
		clientX >= rect.left &&
		clientX < rect.left + rect.width
	);
}

/** 点击是否落在 range 正文行内（用文本片段 rect，避免行尾空白误命中） */
export function isPointInRangeTextBand(
	range: Range,
	iframe: Element | null,
	clientX: number,
	clientY: number,
	maxBelowPx: number,
): boolean {
	const rects = getAccurateRangeLineClientRects(range);
	if (rects.length === 0) return false;

	for (const r of rects) {
		if (pointInTextBandRect(r, clientX, clientY, maxBelowPx)) return true;
	}

	if (!iframe) return false;
	const offset = iframe.getBoundingClientRect();
	for (const r of rects) {
		const local = new DOMRect(
			r.left - offset.left,
			r.top - offset.top,
			r.width,
			r.height,
		);
		if (pointInTextBandRect(local, clientX, clientY, maxBelowPx)) return true;
	}
	return false;
}

/** 用 caret 边界裁剪首行/末行，避免行尾空白也被划线 */
export function getAccurateRangeLineClientRects(range: Range): DOMRect[] {
	const fromText = collectRangeTextClientRects(range);
	const raw =
		fromText.length > 0
			? fromText
			: preferLeafLineClientRects(
					[...range.getClientRects()].filter(
						(r) => r.width > 0.5 && r.height > 0.5,
					),
				);
	if (raw.length === 0) return raw;

	const startCaret = range.cloneRange();
	startCaret.collapse(true);
	const endCaret = range.cloneRange();
	endCaret.collapse(false);
	const startEdge = getCaretClientRect(startCaret);
	const endEdge = getCaretClientRect(endCaret);

	return raw
		.map((rect, index) => {
			let left = rect.left;
			let right = rect.right;

			if (index === 0 && startEdge && sameLine(rect, startEdge)) {
				left = Math.max(left, startEdge.left);
			}
			if (index === raw.length - 1 && endEdge && sameLine(rect, endEdge)) {
				right = Math.min(right, endEdge.right);
			}

			const width = right - left;
			if (width <= 0.5) return null;
			return new DOMRect(left, rect.top, width, rect.height);
		})
		.filter((rect): rect is DOMRect => rect !== null);
}

export type SvgLineSegment = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export function findMarksPaneSvgFromGroup(
	group: Element,
): SVGSVGElement | null {
	const svg = group.closest('svg');
	return svg instanceof SVGSVGElement ? svg : null;
}

export function findMarksPaneContainer(svg: SVGSVGElement): HTMLElement | null {
	const parent = svg.parentElement;
	return parent instanceof HTMLElement ? parent : null;
}

/** 读单个 SVG rect 的局部坐标；非法或过小则 null */
export function parseSvgMarkRect(rect: SVGRectElement): SvgLineSegment | null {
	const x = Number.parseFloat(rect.getAttribute('x') ?? 'NaN');
	const y = Number.parseFloat(rect.getAttribute('y') ?? 'NaN');
	const width = Number.parseFloat(rect.getAttribute('width') ?? 'NaN');
	const height = Number.parseFloat(rect.getAttribute('height') ?? 'NaN');
	if (
		!Number.isFinite(x) ||
		!Number.isFinite(y) ||
		!Number.isFinite(width) ||
		!Number.isFinite(height) ||
		width <= 0.5 ||
		height <= 0.5
	) {
		return null;
	}
	return { x, y, width, height };
}

export function clientRectToSvgLocalSegment(
	clientRect: DOMRect,
	svg: SVGSVGElement,
	container: HTMLElement,
): SvgLineSegment {
	const offset = svg.getBoundingClientRect();
	const containerRect = container.getBoundingClientRect();
	return {
		x: clientRect.left - offset.left + containerRect.left,
		y: clientRect.top - offset.top + containerRect.top,
		width: clientRect.width,
		height: clientRect.height,
	};
}

export function resolveHighlightSvgLineSegments(
	rend: Rendition | undefined,
	group: Element,
	cfiRange?: string,
): SvgLineSegment[] {
	if (!rend || !cfiRange?.trim()) return [];

	const rawRange = resolveCfiDomRange(rend, cfiRange.trim());
	if (!rawRange) return [];

	const range = normalizeSelectionRangeForEpub(rawRange) ?? rawRange;
	return resolveDomRangeSvgLineSegments(group, range);
}

/** 直接用 DOM Range 计算 mark 多行 rect（听书 patch 用，避免 CFI 往返截断） */
export function resolveDomRangeSvgLineSegments(
	group: Element,
	range: Range,
): SvgLineSegment[] {
	const normalized = normalizeSelectionRangeForEpub(range) ?? range;
	const svg = findMarksPaneSvgFromGroup(group);
	const container = svg ? findMarksPaneContainer(svg) : null;
	if (!svg || !container) return [];

	return getAccurateRangeLineClientRects(normalized).map((rect) =>
		clientRectToSvgLocalSegment(rect, svg, container),
	);
}

/** 从 mark 上 epub.js 已写入的 SVG rect 读取线段（patch 热路径，避免 CFI→DOM→getClientRects） */
export function readMarkSvgLineSegmentsFromRects(
	group: Element,
): SvgLineSegment[] {
	const segments: SvgLineSegment[] = [];
	for (const node of group.querySelectorAll('rect')) {
		if (!(node instanceof SVGRectElement)) continue;
		const parsed = parseSvgMarkRect(node);
		if (parsed) segments.push(parsed);
	}
	return segments;
}

/**
 * patch 阶段解析 mark 线段。
 * 跨段落选区时 epub.js rect 会含段落间空行；有 CFI 时用精确文本行几何校正。
 * 校正后 rect 行数稳定时仍走读 rect 快路径（滚动性能）。
 */
export function resolveMarkSvgLineSegments(
	rend: Rendition | undefined,
	group: Element,
	cfiRange?: string,
): SvgLineSegment[] {
	const existing = readMarkSvgLineSegmentsFromRects(group);

	if (rend && cfiRange?.trim()) {
		const accurate = resolveHighlightSvgLineSegments(rend, group, cfiRange);
		if (accurate.length > 0) {
			// 行数一致且总宽接近说明已校正（滚动 patch 快路径）；否则用精确几何替换 epub.js 空行 rect
			if (
				existing.length === accurate.length &&
				segmentsRoughlyMatch(existing, accurate)
			) {
				return existing;
			}
			return accurate;
		}
	}

	if (existing.length > 0) return existing;
	return resolveHighlightSvgLineSegments(rend, group, cfiRange);
}

function segmentsRoughlyMatch(
	existing: SvgLineSegment[],
	accurate: SvgLineSegment[],
): boolean {
	if (existing.length !== accurate.length) return false;
	const sumWidth = (segments: SvgLineSegment[]) =>
		segments.reduce((sum, s) => sum + s.width, 0);
	return Math.abs(sumWidth(existing) - sumWidth(accurate)) < 1;
}

let syncCfiRangeCache: Map<string, Range | null> | null = null;
let syncAccurateClientRectCache: Map<string, DOMRect[]> | null = null;

/** sync 批处理开始时启用 CFI / clientRect 缓存，避免 O(n²) 重复解析 */
export function beginEpubAnnotationSyncScope(): void {
	syncCfiRangeCache = new Map();
	syncAccurateClientRectCache = new Map();
}

export function endEpubAnnotationSyncScope(): void {
	syncCfiRangeCache = null;
	syncAccurateClientRectCache = null;
}

/** sync 阶段带缓存的精确 client rect（供想法被用户划线覆盖判定复用） */
export function getAccurateRangeLineClientRectsCached(
	cfiKey: string,
	range: Range | null,
): DOMRect[] {
	if (!range) return [];
	if (syncAccurateClientRectCache) {
		const cached = syncAccurateClientRectCache.get(cfiKey);
		if (cached) return cached;
		const rects = getAccurateRangeLineClientRects(range);
		syncAccurateClientRectCache.set(cfiKey, rects);
		return rects;
	}
	return getAccurateRangeLineClientRects(range);
}

export function resolveSelectionCfiRange(
	rend: Rendition,
	win: Window,
	range: Range,
): string | undefined {
	const normalized = normalizeSelectionRangeForEpub(range);
	if (!normalized) return undefined;
	const raw = rend.getContents();
	const list: EpubIframeContents[] = Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];

	const matching = list.filter((c) => c.window === win);
	const candidates = matching.length > 0 ? matching : list;

	for (const contents of candidates) {
		try {
			return contents.cfiFromRange(normalized, EPUB_ANNOTATION_IGNORE_CLASS);
		} catch {
			// try next chapter iframe
		}
	}
	return undefined;
}

/**
 * 通过 cfiRange 定位并解析出对应的 DOM Range 区间
 * - 内部支持用 syncCfiRangeCache 做缓存，加速高频查找
 * - 先查缓存有无，如果已缓存则直接返回
 * - 否则尝试解析并写入缓存，最后返回解析结果
 * - 若缓存未启用，则直接走 uncached 逻辑
 * @param rend Rendition 实例（epubjs 渲染器）
 * @param cfiRange EPUB 的 CFI 字符串，标识具体文本区间
 * @returns 对应的 Range 对象，若无法解析则为 null
 */
export function resolveCfiDomRange(
	rend: Rendition,
	cfiRange: string,
): Range | null {
	// 去掉 CFI 字符串首尾空白，避免意外缓存 key 失效
	const key = cfiRange.trim();

	// 若当前在 annotation sync 阶段且有缓存
	if (syncCfiRangeCache && key) {
		// 查找缓存，命中直接返回缓存结果（可能为 null：显式表明“解析失败”也会缓存）
		if (syncCfiRangeCache.has(key)) {
			return syncCfiRangeCache.get(key) ?? null;
		}
		// 未命中缓存时解析，解析结果也写入缓存（容错：解析失败也缓存 null，避免重复尝试）
		const resolved = resolveCfiDomRangeUncached(rend, key);
		syncCfiRangeCache.set(key, resolved);
		return resolved;
	}
	// 非 sync 阶段跳过缓存，直接走 uncached 解析
	return resolveCfiDomRangeUncached(rend, cfiRange);
}

function resolveCfiDomRangeUncached(
	rend: Rendition,
	cfiRange: string,
): Range | null {
	try {
		const range = (
			rend as Rendition & {
				getRange?: (cfi: string, ignoreClass?: string) => Range | null;
			}
		).getRange?.(cfiRange, EPUB_ANNOTATION_IGNORE_CLASS);
		if (range) return range;
	} catch {
		// ignore
	}

	for (const contents of getRenditionContentsList(rend)) {
		try {
			const range = (
				contents as EpubIframeContents & {
					range?: (cfi: string, ignoreClass?: string) => Range | null;
				}
			).range?.(cfiRange, EPUB_ANNOTATION_IGNORE_CLASS);
			if (range) return range;
		} catch {
			// try next iframe
		}
	}
	return null;
}

export function cfiFromDomRange(
	rend: Rendition,
	range: Range,
): string | undefined {
	const doc = range.startContainer.ownerDocument;
	if (!doc) return undefined;

	for (const contents of getRenditionContentsList(rend)) {
		if (contents.document !== doc) continue;
		try {
			return contents.cfiFromRange(range, EPUB_ANNOTATION_IGNORE_CLASS);
		} catch {
			// try next iframe
		}
	}
	return undefined;
}
