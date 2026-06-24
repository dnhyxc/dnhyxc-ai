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
