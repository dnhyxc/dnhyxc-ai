/**
 * EPUB 批注 / 听读 mark 层共用：CFI 嵌套判定、Range 关系、SVG 属性写入。
 * 用户划线、想法虚线、听书背景均依赖此处，避免三处拷贝漂移。
 */
import type { Rendition } from 'epubjs';

export type EpubIframeContents = {
	document: Document;
	window: Window;
	cfiFromRange: (range: Range, ignoreClass?: string) => string;
};

/** epub.js getContents() 归一化为数组 */
export function getRenditionContentsList(
	rend?: Rendition,
): EpubIframeContents[] {
	if (!rend) return [];
	const raw = rend.getContents();
	return Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];
}

/** 仅在属性变化时写入，减少 patch 热路径 DOM 抖动 */
export function setSvgAttrIfChanged(
	el: Element,
	name: string,
	value: string,
): void {
	if (el.getAttribute(name) !== value) {
		el.setAttribute(name, value);
	}
}

/** 从 CFI 提取 spine 路径（`!` 之前），用于同章节嵌套判定 */
export function extractCfiSpineHint(cfiRange: string): string {
	const match = cfiRange.match(/epubcfi\(([^!]+)!/);
	return match?.[1] ?? cfiRange;
}

/** innerQuote 是否为 outerQuote 的严格连续子串（不全等） */
export function isQuoteStrictlyNested(
	innerQuote: string,
	outerQuote: string,
): boolean {
	if (!innerQuote || !outerQuote || innerQuote === outerQuote) return false;
	return outerQuote.includes(innerQuote);
}

/** inner Range 是否被 outer Range 严格包含（非完全重合） */
export function isDomRangeStrictlyContained(
	inner: Range,
	outer: Range,
): boolean {
	try {
		const startsAfterOrEqual =
			inner.compareBoundaryPoints(Range.START_TO_START, outer) >= 0;
		const endsBeforeOrEqual =
			inner.compareBoundaryPoints(Range.END_TO_END, outer) <= 0;
		if (!startsAfterOrEqual || !endsBeforeOrEqual) return false;
		const sameStart =
			inner.compareBoundaryPoints(Range.START_TO_START, outer) === 0;
		const sameEnd = inner.compareBoundaryPoints(Range.END_TO_END, outer) === 0;
		return !(sameStart && sameEnd);
	} catch {
		return false;
	}
}

/** 两 Range 真实相交（不含仅端点相接） */
export function isDomRangeOverlapping(a: Range, b: Range): boolean {
	try {
		if (a.startContainer.ownerDocument !== b.startContainer.ownerDocument) {
			return false;
		}
		return (
			a.compareBoundaryPoints(Range.END_TO_START, b) > 0 &&
			a.compareBoundaryPoints(Range.START_TO_END, b) < 0
		);
	} catch {
		return false;
	}
}

/** 相交或端点相接（共享边界字符场景） */
export function isDomRangeTouchingOrOverlapping(a: Range, b: Range): boolean {
	try {
		if (a.startContainer.ownerDocument !== b.startContainer.ownerDocument) {
			return false;
		}
		return (
			a.compareBoundaryPoints(Range.END_TO_START, b) >= 0 &&
			a.compareBoundaryPoints(Range.START_TO_END, b) <= 0
		);
	} catch {
		return false;
	}
}

/** 文档内 marks-pane 下的 SVG（听书层 ensure group 用） */
export function findMarksPaneSvgInDocument(
	doc: Document,
): SVGSVGElement | null {
	for (const pane of doc.querySelectorAll('.marks-pane')) {
		const svg = pane.querySelector('svg');
		if (svg instanceof SVGSVGElement) return svg;
	}
	return null;
}
