import type { Rendition } from 'epubjs';
import { cfiFromDomRange, resolveCfiDomRange } from '../mark/epubRangeGeometry';
import { getEpubScrollContainer } from './epubScrolledNav';

export type EpubViewportPin = {
	cfi: string;
	/** 锚点相对滚动容器顶边的视口偏移（px） */
	offsetFromTop: number;
};

function caretRangeFromPoint(
	doc: Document,
	x: number,
	y: number,
): Range | null {
	if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
	const withCaret = doc as Document & {
		caretPositionFromPoint?: (
			px: number,
			py: number,
		) => { offsetNode: Node; offset: number } | null;
	};
	const pos = withCaret.caretPositionFromPoint?.(x, y);
	if (!pos) return null;
	const range = doc.createRange();
	range.setStart(pos.offsetNode, pos.offset);
	range.collapse(true);
	return range;
}

function rangeOffsetFromContainerTop(
	range: Range,
	iframe: HTMLIFrameElement,
	container: HTMLElement,
): number {
	const rect = range.getBoundingClientRect();
	const iframeRect = iframe.getBoundingClientRect();
	const containerRect = container.getBoundingClientRect();
	const top =
		rect.height > 0 || rect.width > 0
			? iframeRect.top + rect.top
			: iframeRect.top + rect.top;
	return top - containerRect.top;
}

/**
 * soft resize / 分栏宽度变化前采样：视口上方正文 → CFI + 相对容器顶偏移。
 * ponytail: 仅连续滚动；分页无 scroll 容器时返回 null。
 */
export function captureEpubViewportPin(
	rend: Rendition,
): EpubViewportPin | null {
	const container = getEpubScrollContainer(rend);
	if (!container) return null;

	const containerRect = container.getBoundingClientRect();
	if (containerRect.height < 1 || containerRect.width < 1) return null;

	const sampleY =
		containerRect.top + Math.min(96, Math.max(24, containerRect.height * 0.2));
	const sampleX = containerRect.left + containerRect.width / 2;

	for (const el of container.querySelectorAll('iframe')) {
		const iframe = el as HTMLIFrameElement;
		const iframeRect = iframe.getBoundingClientRect();
		if (sampleY < iframeRect.top || sampleY > iframeRect.bottom) continue;
		const doc = iframe.contentDocument;
		if (!doc) continue;
		const range = caretRangeFromPoint(
			doc,
			sampleX - iframeRect.left,
			sampleY - iframeRect.top,
		);
		if (!range) continue;
		const cfi = cfiFromDomRange(rend, range)?.trim();
		if (!cfi) continue;
		return {
			cfi,
			offsetFromTop: rangeOffsetFromContainerTop(range, iframe, container),
		};
	}
	return null;
}

/** soft resize 后把采样锚点滚回原视口偏移，避免正文被挤出屏外 */
export function restoreEpubViewportPin(
	rend: Rendition,
	pin: EpubViewportPin | null,
): boolean {
	if (!pin?.cfi) return false;
	const container = getEpubScrollContainer(rend);
	if (!container) return false;
	const range = resolveCfiDomRange(rend, pin.cfi);
	if (!range) return false;
	const win = range.startContainer.ownerDocument?.defaultView;
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	if (!iframe) return false;

	const offset = rangeOffsetFromContainerTop(range, iframe, container);
	const delta = offset - pin.offsetFromTop;
	if (Math.abs(delta) < 1) return true;
	container.scrollTop += delta;
	return true;
}
