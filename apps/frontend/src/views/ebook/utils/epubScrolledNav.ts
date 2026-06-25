import type { Rendition } from 'epubjs';

import { cfiFromDomRange, resolveCfiDomRange } from './epubRangeGeometry';

const SCROLL_EDGE_PX = 16;
/** 分栏开合后保持引用段落在视口内的上下留白 */
const QUOTE_VIEW_MARGIN_PX = 72;
const EDGE_COOLDOWN_MS = 320;

type EpubManager = {
	container?: HTMLElement;
	check?: () => Promise<unknown>;
};

/**
 * 获取 epub.js 连续滚动模式下的实际滚动容器 HTMLElement
 * - 由于 oepub.js 的 Rendition.manager 实现为私有属性，这里只能用类型断言强行访问
 * - manager?.container 指向渲染所有章节的主滚动 <div>，用于手动定位/滚动
 * - 若未初始化或非连续滚动，则为 null
 * @param rend epub.js 的 Rendition 实例
 * @returns 主滚动容器 HTMLElement，若不可用则返回 null
 */
export function getEpubScrollContainer(rend: Rendition): HTMLElement | null {
	// 类型断言获取私有 manager 属性（oepubjs 未暴露正式类型）
	const manager = (rend as unknown as { manager?: EpubManager }).manager;
	// 返回 epub 连续滚动容器，若 manager 不存在则返回 null
	return manager?.container ?? null;
}

/**
 * 尝试获取 epub.js Rendition 实例的内部 manager（通常为 ContinuousViewManager 实例）
 * - 仅用于需要底层滚动/检查的极少场景
 * - 若当前不是连续滚动模式，可能返回 null
 * @param rend epub.js 的 Rendition 实例
 * @returns manager 对象或 null
 */
function getManager(rend: Rendition): EpubManager | null {
	// 类型断言强行访问私有 manager 属性，未初始化场景返回 null
	return (rend as unknown as { manager?: EpubManager }).manager ?? null;
}

/**
 * 检查当前滚动容器（epub 连续滚动的主 div）是否已滚动到顶部/底部
 * - 小于等于 SCROLL_EDGE_PX 像素视为到顶，反之到底
 * - 用于避免过度卷动边缘，以及判定是否可以继续向上/下滚动
 * @param container 连续滚动 epub 内容容器 HTMLElement
 * @returns { atTop: boolean, atBottom: boolean } 顶/底边界状态
 */
function scrollEdges(container: HTMLElement) {
	const { scrollTop, scrollHeight, clientHeight } = container;
	return {
		// 离顶部 ≤ SCROLL_EDGE_PX 视为到顶
		atTop: scrollTop <= SCROLL_EDGE_PX,
		// 底部实际滚动位置 ≥ 总高度-边距 视为到底
		atBottom: scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX,
	};
}

/**
 * 计算给定 Range 在主页面中的绝对 top/bottom 坐标（像素值）
 * 主要用于确定被引用 range 是否进入可视区域、以及需不需要额外滚动以避开边界
 * @param range 文档内的 DOM Range
 * @param iframe 承载该 range 的 iframe 元素（epubjs 内文通常在 iframe 渲染）
 * @returns { top: number, bottom: number } 绝对页面像素坐标，对应 range 在主页面窗口的上下边界
 */
function readRangeViewportBounds(range: Range, iframe: HTMLIFrameElement) {
	// 先尝试取 range 的整体矩形，适用于 range 覆盖一定内容长度（存在 width/height）
	const rect = range.getBoundingClientRect();
	if (rect.width > 0 || rect.height > 0) {
		// 计算方式：range.rect （相对所在 iframe），加上 iframe 本身在主页面上的 rect.top
		const iframeRect = iframe.getBoundingClientRect();
		return {
			top: iframeRect.top + rect.top, // range 顶部在主页面的像素坐标
			bottom: iframeRect.top + rect.bottom, // range 底部在主页面的像素坐标
		};
	}
	// 若 range 没有可见内容（如零宽度：可能是 caret 选区/空 range）需特殊处理
	// 此处用 collapse(true) 得到起始点的光标位置
	const caret = range.cloneRange();
	caret.collapse(true);
	const caretRect = caret.getBoundingClientRect();
	const iframeRect = iframe.getBoundingClientRect();
	const y = iframeRect.top + caretRect.top;
	// 若高度为 0，也给予至少 1 px 高，避免上下边界重叠导致数学判断问题
	return { top: y, bottom: y + Math.max(caretRect.height, 1) };
}

function isDomRangeInReaderView(
	rend: Rendition,
	range: Range,
	marginPx: number,
): boolean {
	const win = range.startContainer.ownerDocument?.defaultView;
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	if (!iframe) return false;

	const { top, bottom } = readRangeViewportBounds(range, iframe);
	const container = getEpubScrollContainer(rend);
	const boundsRect = container
		? container.getBoundingClientRect()
		: iframe.getBoundingClientRect();

	return (
		top >= boundsRect.top + marginPx && bottom <= boundsRect.bottom - marginPx
	);
}

/**
 * 连续滚动：将 DOM Range 滚入阅读容器视口（带上下留白）
 *
 * @param rend    EPUB.js 的 Rendition 实例，用于定位阅读容器
 * @param range   需要滚入视口的 DOM Range（一般在 EPUB iframe 内文）
 * @returns       是否已成功滚入（若因参数/环境异常返回 false）
 */
export function scrollEpubDomRangeIntoView(
	rend: Rendition,
	range: Range,
): boolean {
	// 获取当前 EPUB 阅读器的 scroll 容器（通常仅在连续滚动模式下存在）
	const container = getEpubScrollContainer(rend);
	// 若未找到 scroll 容器，表明当前不支持连续滚动，直接返回 false
	if (!container) return false;

	// 获取 range 所在文档的 window 对象（通常为 iframe 的 window）
	const win = range.startContainer.ownerDocument?.defaultView;
	// 通过 window.frameElement 拿到所属 iframe 元素
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	// 若找不到所属 iframe，则无法计算跨 iframe 的绝对位置，返回 false
	if (!iframe) return false;

	// 计算 range 在主页面上的像素 top/bottom 坐标（绝对位置，含跨 iframe 偏移）
	const { top, bottom } = readRangeViewportBounds(range, iframe);

	// 获取容器的可视区域（主页面上的 DOMRect）
	const containerRect = container.getBoundingClientRect();

	let delta = 0;
	// 若 range 顶部已超出容器上边缘（含留白），需向上滚动
	if (top < containerRect.top + QUOTE_VIEW_MARGIN_PX) {
		delta = top - containerRect.top - QUOTE_VIEW_MARGIN_PX;
		// 否则，若底部超出容器下边缘（含留白），需向下滚动
	} else if (bottom > containerRect.bottom - QUOTE_VIEW_MARGIN_PX) {
		delta = bottom - containerRect.bottom + QUOTE_VIEW_MARGIN_PX;
	}

	// 若无需滚动（range 已完全在留白包裹的可见容器内），直接返回 true
	if (delta === 0) return true;
	// 根据计算的 delta 调整容器 scrollTop，令内容刚好滚入并预留边距
	container.scrollTop += delta;
	return true;
}

/**
 * 听当前 / 引用定位：Range 不在视口内时滚入可见区域。
 * 连续滚动调容器 scrollTop；分页模式 rend.display(cfi) 翻页。
 */
export async function scrollEpubRangeIntoView(
	rend: Rendition,
	range: Range,
	fallbackCfi?: string,
): Promise<boolean> {
	try {
		if (isDomRangeInReaderView(rend, range, QUOTE_VIEW_MARGIN_PX)) {
			return true;
		}
	} catch {
		return false;
	}

	if (getEpubScrollContainer(rend)) {
		return scrollEpubDomRangeIntoView(rend, range);
	}

	const cfi = cfiFromDomRange(rend, range)?.trim() || fallbackCfi?.trim();
	if (!cfi) return false;

	try {
		await rend.display(cfi);
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => {
				requestAnimationFrame(() => resolve());
			});
		});
	} catch {
		return false;
	}

	const resolved = resolveCfiDomRange(rend, cfi);
	if (!resolved) return true;
	try {
		return isDomRangeInReaderView(rend, resolved, QUOTE_VIEW_MARGIN_PX);
	} catch {
		return true;
	}
}

/** 将 CFI 对应正文滚入视口（仅连续滚动；分页请用 scrollEpubRangeIntoView） */
export function scrollEpubCfiIntoView(
	rend: Rendition,
	cfiRange: string,
): boolean {
	const key = cfiRange.trim();
	if (!key) return false;

	const range = resolveCfiDomRange(rend, key);
	if (!range) return false;

	return scrollEpubDomRangeIntoView(rend, range);
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
