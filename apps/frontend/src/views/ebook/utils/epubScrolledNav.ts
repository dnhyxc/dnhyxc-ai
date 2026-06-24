import type { Rendition } from 'epubjs';

import { resolveCfiDomRange } from './epubRangeGeometry';

const SCROLL_EDGE_PX = 16;
/** 分栏开合后保持引用段落在视口内的上下留白 */
const QUOTE_VIEW_MARGIN_PX = 72;
const EDGE_COOLDOWN_MS = 320;

type EpubManager = {
	container?: HTMLElement;
	check?: () => Promise<unknown>;
};

/** epub.js 连续滚动时的实际滚动容器 */
export function getEpubScrollContainer(rend: Rendition): HTMLElement | null {
	const manager = (rend as unknown as { manager?: EpubManager }).manager;
	return manager?.container ?? null;
}

function getManager(rend: Rendition): EpubManager | null {
	return (rend as unknown as { manager?: EpubManager }).manager ?? null;
}

function scrollEdges(container: HTMLElement) {
	const { scrollTop, scrollHeight, clientHeight } = container;
	return {
		atTop: scrollTop <= SCROLL_EDGE_PX,
		atBottom: scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX,
	};
}

function readRangeViewportBounds(range: Range, iframe: HTMLIFrameElement) {
	const rect = range.getBoundingClientRect();
	if (rect.width > 0 || rect.height > 0) {
		const iframeRect = iframe.getBoundingClientRect();
		return {
			top: iframeRect.top + rect.top,
			bottom: iframeRect.top + rect.bottom,
		};
	}
	const caret = range.cloneRange();
	caret.collapse(true);
	const caretRect = caret.getBoundingClientRect();
	const iframeRect = iframe.getBoundingClientRect();
	const y = iframeRect.top + caretRect.top;
	return { top: y, bottom: y + Math.max(caretRect.height, 1) };
}

/**
 * 连续滚动模式下，将 CFI 对应正文滚入 epub 滚动容器视口（分栏宽度变化后防引用段被挤出屏外）。
 * ponytail: 仅改 scrollTop，O(1)；分页模式无滚动容器时直接返回 false。
 */
export function scrollEpubCfiIntoView(
	rend: Rendition,
	cfiRange: string,
): boolean {
	const key = cfiRange.trim();
	if (!key) return false;
	const range = resolveCfiDomRange(rend, key);
	if (!range) return false;
	const container = getEpubScrollContainer(rend);
	if (!container) return false;
	const win = range.startContainer.ownerDocument?.defaultView;
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	if (!iframe) return false;

	const { top, bottom } = readRangeViewportBounds(range, iframe);
	const containerRect = container.getBoundingClientRect();
	let delta = 0;
	if (top < containerRect.top + QUOTE_VIEW_MARGIN_PX) {
		delta = top - containerRect.top - QUOTE_VIEW_MARGIN_PX;
	} else if (bottom > containerRect.bottom - QUOTE_VIEW_MARGIN_PX) {
		delta = bottom - containerRect.bottom + QUOTE_VIEW_MARGIN_PX;
	}
	if (delta === 0) return true;
	container.scrollTop += delta;
	return true;
}

/** 连续滚动：滚到顶/底时衔接相邻 spine（优先 manager.check，回退 prev/next） */
export function attachEpubScrolledEdgeNav(
	rend: Rendition,
	isDestroyed: () => boolean,
): () => void {
	const container = getEpubScrollContainer(rend);
	if (!container) return () => {};

	let busy = false;
	let cooldownUntil = 0;

	const runEdgeAction = (action: 'prev' | 'next', e?: Event) => {
		if (isDestroyed() || busy || Date.now() < cooldownUntil) return;
		e?.preventDefault();

		busy = true;
		cooldownUntil = Date.now() + EDGE_COOLDOWN_MS;

		const manager = getManager(rend);
		const task = manager?.check
			? Promise.resolve(manager.check())
			: Promise.resolve(action === 'next' ? rend.next() : rend.prev());

		void task
			.catch(() => undefined)
			.finally(() => {
				busy = false;
			});
	};

	const onWheel = (e: WheelEvent) => {
		const dy = e.deltaY;
		if (dy === 0) return;

		const { atTop, atBottom } = scrollEdges(container);
		if (dy > 0 && atBottom) runEdgeAction('next', e);
		else if (dy < 0 && atTop) runEdgeAction('prev', e);
	};

	container.addEventListener('wheel', onWheel, { passive: false });

	return () => {
		container.removeEventListener('wheel', onWheel);
	};
}
