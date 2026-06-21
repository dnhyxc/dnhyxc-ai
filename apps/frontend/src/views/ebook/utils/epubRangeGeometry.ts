import type { Rendition } from 'epubjs';

type EpubIframeContents = {
	document: Document;
	window: Window;
	cfiFromRange: (range: Range, ignoreClass?: string) => string;
};

export const EPUB_ANNOTATION_IGNORE_CLASS = 'epubjs-hl';

function getRenditionContentsList(rend?: Rendition): EpubIframeContents[] {
	if (!rend) return [];
	const raw = rend.getContents();
	return Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];
}

function trimBoundary(range: Range, fromStart: boolean): void {
	while (true) {
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
	const walker = doc.createTreeWalker(
		range.commonAncestorContainer,
		NodeFilter.SHOW_TEXT,
		{
			acceptNode(node) {
				try {
					return range.intersectsNode(node)
						? NodeFilter.FILTER_ACCEPT
						: NodeFilter.FILTER_REJECT;
				} catch {
					return NodeFilter.FILTER_REJECT;
				}
			},
		},
	);

	for (
		let node = walker.nextNode() as Text | null;
		node;
		node = walker.nextNode() as Text | null
	) {
		const start = node === range.startContainer ? range.startOffset : 0;
		const end = node === range.endContainer ? range.endOffset : node.length;
		if (start >= end) continue;

		const segment = doc.createRange();
		segment.setStart(node, start);
		segment.setEnd(node, end);
		for (const rect of segment.getClientRects()) {
			if (rect.width > 0.5 && rect.height > 0.5) {
				rects.push(rect);
			}
		}
	}

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

function findMarksPaneSvg(group: Element): SVGSVGElement | null {
	const svg = group.closest('svg');
	return svg instanceof SVGSVGElement ? svg : null;
}

function findMarksPaneContainer(svg: SVGSVGElement): HTMLElement | null {
	const parent = svg.parentElement;
	return parent instanceof HTMLElement ? parent : null;
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

	const range = resolveCfiDomRange(rend, cfiRange.trim());
	if (!range) return [];

	const svg = findMarksPaneSvg(group);
	const container = svg ? findMarksPaneContainer(svg) : null;
	if (!svg || !container) return [];

	return getAccurateRangeLineClientRects(range).map((rect) =>
		clientRectToSvgLocalSegment(rect, svg, container),
	);
}

export function resolveSelectionCfiRange(
	rend: Rendition,
	win: Window,
	range: Range,
): string | undefined {
	const normalized = trimSelectionRange(range);
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

export function resolveCfiDomRange(
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
