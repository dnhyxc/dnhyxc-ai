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
 * 将指定 CFI 范围（cfiRange）对应的正文片段滚动到 epub 连续滚动容器的可视区域内。
 * 用于分栏宽度变化等场景，确保被引用的段落不会因布局变化而被挤出可视范围。
 *
 * 简要逻辑：
 *   1. 校验 CFI 有效性，解析对应 DOM Range。
 *   2. 获取实际滚动容器（容纳所有分页的滚动 div)。
 *   3. 定位 CFI 所在的 iframe，并读取 range 在主页面的绝对可视坐标(top/bottom)。
 *   4. 计算该 range 边界与容器视口的相对距离。
 *   5. 若未达到指定留白边距（QUOTE_VIEW_MARGIN_PX），则滚动使其进入视口且留白，避免被边缘裁剪。
 *   6. 若无需滚动则直接返回 true（已在合适视图内）；否则直接调整 scrollTop。
 *
 * @param rend epub.js 的 Rendition 实例
 * @param cfiRange 需要滚动到视图的 epub CFI 范围字符串
 * @returns boolean 是否滚动/定位成功（即 CFI 有效且属于连续滚动模式的 epub 容器）
 */
export function scrollEpubCfiIntoView(
	rend: Rendition,
	cfiRange: string,
): boolean {
	// 去空白，防止传入非法或全空字符串
	const key = cfiRange.trim();
	if (!key) return false;

	// 通过 CFI 定位到正文中的 DOM range，找不到则无操作
	const range = resolveCfiDomRange(rend, key);
	if (!range) return false;

	// 获取当前 epub 滚动容器，仅在连续滚动模式有效，若无则表明当前并非该模式
	const container = getEpubScrollContainer(rend);
	if (!container) return false;

	// 获取 range 对应节点所在的 iframe（epub 正文实际是 iframe 内渲染的）
	const win = range.startContainer.ownerDocument?.defaultView;
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	if (!iframe) return false;

	// 计算 range 在主页面上的绝对像素 top/bottom 坐标
	const { top, bottom } = readRangeViewportBounds(range, iframe);

	// 获取滚动容器在页面上的坐标，便于后续比较范围与容器的可见关系
	const containerRect = container.getBoundingClientRect();

	let delta = 0;

	// 如果 range 顶距离容器视口顶不足预留边距，则向上滚动，露出更多内容（让正文头部带足够 margin）
	if (top < containerRect.top + QUOTE_VIEW_MARGIN_PX) {
		delta = top - containerRect.top - QUOTE_VIEW_MARGIN_PX;
	}
	// 如果 range 底部距离容器视口底不足预留边距，则向下滚动（正文贴近底部时也需露边距）
	else if (bottom > containerRect.bottom - QUOTE_VIEW_MARGIN_PX) {
		delta = bottom - containerRect.bottom + QUOTE_VIEW_MARGIN_PX;
	}

	// 若无需滚动（已在合适范围内），直接返回 true（相当于 noop）
	if (delta === 0) return true;

	// 实际滚动滚动容器，通过调整 scrollTop 保证内容进入可视范围
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
