import type { Book, Rendition } from 'epubjs';

import { cfiFromDomRange, resolveCfiDomRange } from '../mark/epubRangeGeometry';
import { resolveSpineIndexForHref } from './epubSpineIndex';

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

type EpubViewSlot = {
	index: number;
	element?: HTMLElement;
};

function pauseForLayout(): Promise<void> {
	return new Promise((resolve) => {
		requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
	});
}

function findViewElForSpineIndex(
	rend: Rendition,
	spineIndex: number,
): HTMLElement | null {
	const views = (
		rend as unknown as { manager?: { views?: { all?: () => EpubViewSlot[] } } }
	).manager?.views?.all?.();
	const match = views?.find((view) => view.index === spineIndex);
	return match?.element ?? null;
}

async function resolveViewElAfterDisplay(
	rend: Rendition,
	book: Book,
	href: string,
): Promise<HTMLElement | null> {
	const spineIndex = resolveSpineIndexForHref(book, href);
	if (spineIndex != null) {
		const byIndex = findViewElForSpineIndex(rend, spineIndex);
		if (byIndex) return byIndex;
	}

	try {
		const loc = (await Promise.resolve(rend.currentLocation())) as
			| { start?: { index?: number } }
			| undefined;
		const idx = loc?.start?.index;
		if (idx != null) {
			const byLoc = findViewElForSpineIndex(rend, idx);
			if (byLoc) return byLoc;
		}
	} catch {
		// currentLocation 不可用
	}

	if (href.includes('#')) {
		const host = getEpubScrollContainer(rend);
		if (host) {
			for (const el of host.querySelectorAll('.epub-view')) {
				const viewEl = el as HTMLElement;
				if (resolveNavAnchor(viewEl, href)) return viewEl;
			}
		}
	}

	return null;
}

function findNavAnchor(
	rend: Rendition,
	viewEl: HTMLElement | null,
	href: string,
): HTMLElement | null {
	if (viewEl) {
		const hit = resolveNavAnchor(viewEl, href);
		if (hit) return hit;
	}

	const host = getEpubScrollContainer(rend);
	if (!host) return null;
	for (const el of host.querySelectorAll('.epub-view')) {
		const hit = resolveNavAnchor(el as HTMLElement, href);
		if (hit) return hit;
	}
	return null;
}

/** 连续滚动目录跳转：目标 .epub-view 应对齐的 scrollTop */
export function scrolledChapterScrollTop(viewOffsetTop: number): number {
	return Math.max(0, viewOffsetTop - SCROLL_EDGE_PX);
}

/** 目录跳转：目标元素顶边相对容器顶边的 scrollTop 增量 */
export function scrolledNavAlignDelta(
	targetTop: number,
	containerTop: number,
): number {
	return targetTop - containerTop - SCROLL_EDGE_PX;
}

function resolveNavAnchor(
	viewEl: HTMLElement,
	href: string,
): HTMLElement | null {
	const hash = href.split('#')[1];
	if (!hash) return null;

	let decoded = hash;
	try {
		decoded = decodeURIComponent(hash);
	} catch {
		// 保留原始 hash
	}

	const doc = viewEl.querySelector('iframe')?.contentDocument;
	if (!doc) return null;

	const anchor =
		doc.getElementById(decoded) ??
		doc.querySelector(`a[name="${CSS.escape(decoded)}"]`) ??
		doc.querySelector(`[id="${CSS.escape(decoded)}"]`);
	return anchor instanceof HTMLElement ? anchor : null;
}

function alignViewTopToContainer(
	rend: Rendition,
	viewEl: HTMLElement,
): boolean {
	const container = getEpubScrollContainer(rend);
	if (!container) return false;

	const delta = scrolledNavAlignDelta(
		viewEl.getBoundingClientRect().top,
		container.getBoundingClientRect().top,
	);
	if (Math.abs(delta) < 1) return true;
	container.scrollTop += delta;
	return true;
}

function alignElementTopToContainer(
	rend: Rendition,
	target: HTMLElement,
): boolean {
	const container = getEpubScrollContainer(rend);
	if (!container) return false;

	const delta = scrolledNavAlignDelta(
		target.getBoundingClientRect().top,
		container.getBoundingClientRect().top,
	);
	if (Math.abs(delta) < 1) return true;
	container.scrollTop += delta;
	return true;
}

async function trimContinuousViews(rend: Rendition): Promise<void> {
	const manager = (
		rend as unknown as { manager?: { trim?: () => Promise<unknown> } }
	).manager;
	const trim = manager?.trim;
	if (!trim) return;
	// epub.js continuous trim 内部会读 views；manager 未就绪时同步抛错，不能只 .catch Promise
	try {
		await Promise.resolve(trim.call(manager));
	} catch {
		// ponytail: 目录跳转 settle 时偶发 views 未挂好；跳过 trim，后续对齐仍可用
	}
}

function alignScrolledNavTarget(
	rend: Rendition,
	href: string,
	viewEl: HTMLElement | null,
): boolean {
	const hasFragment = href.includes('#');
	const anchor = findNavAnchor(rend, viewEl, href);
	if (anchor) return alignElementTopToContainer(rend, anchor);
	if (hasFragment) return false;
	if (!viewEl) return false;

	return alignViewTopToContainer(rend, viewEl);
}

// ponytail: 固定次数校正 + trim；upgrade: ResizeObserver 直到 targetTop 稳定
const NAV_ALIGN_SETTLE_MS = [0, 100, 220] as const;

async function settleScrolledNavAlign(
	rend: Rendition,
	book: Book,
	href: string,
): Promise<void> {
	for (let i = 0; i < NAV_ALIGN_SETTLE_MS.length; i += 1) {
		const delay = NAV_ALIGN_SETTLE_MS[i]!;
		if (delay > 0) {
			await new Promise<void>((resolve) => {
				window.setTimeout(resolve, delay);
			});
		}
		await pauseForLayout();
		const viewEl = await resolveViewElAfterDisplay(rend, book, href);
		alignScrolledNavTarget(rend, href, viewEl);
		if (i === 1) {
			await trimContinuousViews(rend);
			await pauseForLayout();
			const trimmedView = await resolveViewElAfterDisplay(rend, book, href);
			alignScrolledNavTarget(rend, href, trimmedView);
		}
	}
}

/**
 * 连续滚动：目录/外链 href 跳转后把目标章顶对齐视口。
 * epub.js continuous 在 display 后 prepend 邻章、批注 patch 会改布局；单次 offsetTop 不够，需多次按视口坐标校正。
 */
export async function displayEpubScrolledHref(
	rend: Rendition,
	book: Book,
	href: string,
): Promise<void> {
	await rend.display(href);
	if (!getEpubScrollContainer(rend)) return;

	await pauseForLayout();
	await settleScrolledNavAlign(rend, book, href);
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
 * 判断给定 DOM Range 是否已在阅读器可视区域（含指定 marginPx 内边距）
 * 用于 EPUB 连续滚动模式，需支持多 iframe 下主页面坐标判断
 *
 * @param rend     EPUB.js Rendition 实例，用于确定主滚动容器
 * @param range    需检测可见性的 DOM Range（一般落在内文 iframe）
 * @param marginPx 上下边界预留多少像素安全边距（进视区域再留白）
 * @returns        是否已完全在可见范围内（含 marginPx 安全留白）
 */
export function isEpubRangeInReaderView(
	rend: Rendition,
	range: Range,
	marginPx: number = QUOTE_VIEW_MARGIN_PX,
): boolean {
	// 1. 获取 range 所在文档的 window 对象
	const win = range.startContainer.ownerDocument?.defaultView;
	// 2. 通过 window 拿到对应的 iframe 元素
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	// 若未找到 iframe，则无法判断，直接判为不可见
	if (!iframe) return false;

	// 3. 计算 range 在主页面的绝对 top/bottom 坐标（跨 iframe 偏移）
	const { top, bottom } = readRangeViewportBounds(range, iframe);
	// 4. 获取 EPUB 主阅读容器的 DOMRect（若找不到，用 iframe 兜底）
	const container = getEpubScrollContainer(rend);
	const boundsRect = container
		? container.getBoundingClientRect()
		: iframe.getBoundingClientRect();

	// 5. 判断 range 是否已在容器的 marginPx 以内可视区
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

/** 连续滚动：将 Range 垂直居中到阅读容器视口 */
export function scrollEpubDomRangeToCenter(
	rend: Rendition,
	range: Range,
): boolean {
	const container = getEpubScrollContainer(rend);
	if (!container) return false;

	const win = range.startContainer.ownerDocument?.defaultView;
	const iframe = win?.frameElement as HTMLIFrameElement | null;
	if (!iframe) return false;

	const { top, bottom } = readRangeViewportBounds(range, iframe);
	const rangeMid = (top + bottom) / 2;
	const containerRect = container.getBoundingClientRect();
	const containerMid = (containerRect.top + containerRect.bottom) / 2;
	container.scrollTop += rangeMid - containerMid;
	return true;
}

/**
 * 听书分句跳转等：将 Range 滚到视口中央；分页模式回退 scrollEpubRangeIntoView。
 * 连续滚动下若章 iframe 已被 trim，DOM 滚动无效，需 display(cfi) 重新挂载。
 */
export async function scrollEpubRangeToViewCenter(
	rend: Rendition,
	range: Range,
	fallbackCfi?: string,
): Promise<boolean> {
	if (getEpubScrollContainer(rend)) {
		if (canScrollDomRangeInLayout(range)) {
			try {
				if (scrollEpubDomRangeToCenter(rend, range)) {
					try {
						if (isEpubRangeInReaderView(rend, range, QUOTE_VIEW_MARGIN_PX)) {
							return true;
						}
					} catch {
						// fall through → CFI
					}
				}
			} catch {
				// fall through → CFI
			}
		}
		return bringEpubCfiIntoScrolledView(rend, range, fallbackCfi, 'center');
	}
	return scrollEpubRangeIntoView(rend, range, fallbackCfi);
}

/**
 * 听当前 / 引用定位：Range 不在视口内时滚入可见区域。
 * 连续滚动调容器 scrollTop；跨章 trim 后回退 rend.display(cfi)；分页模式同样走 CFI。
 */
export async function scrollEpubRangeIntoView(
	rend: Rendition,
	range: Range,
	fallbackCfi?: string,
): Promise<boolean> {
	try {
		if (isEpubRangeInReaderView(rend, range, QUOTE_VIEW_MARGIN_PX)) {
			return true;
		}
	} catch {
		// range/iframe 可能已因 continuous trim 失效
	}

	if (getEpubScrollContainer(rend)) {
		if (canScrollDomRangeInLayout(range)) {
			try {
				if (scrollEpubDomRangeIntoView(rend, range)) {
					try {
						if (isEpubRangeInReaderView(rend, range, QUOTE_VIEW_MARGIN_PX)) {
							return true;
						}
					} catch {
						// fall through → CFI
					}
				}
			} catch {
				// fall through → CFI
			}
		}
		return bringEpubCfiIntoScrolledView(rend, range, fallbackCfi, 'nearest');
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
		return isEpubRangeInReaderView(rend, resolved, QUOTE_VIEW_MARGIN_PX);
	} catch {
		return true;
	}
}

/** continuous 下目标章 iframe 仍挂在布局里时才可直接改 scrollTop */
function canScrollDomRangeInLayout(range: Range): boolean {
	try {
		const win = range.startContainer.ownerDocument?.defaultView;
		const iframe = win?.frameElement as HTMLIFrameElement | null;
		if (!iframe?.isConnected) return false;
		const rect = iframe.getBoundingClientRect();
		return rect.width > 0 || rect.height > 0;
	} catch {
		return false;
	}
}

/** 用 CFI 重新 display 挂载目标章，再滚入视口（跨章听书回到播放位置） */
async function bringEpubCfiIntoScrolledView(
	rend: Rendition,
	range: Range | null,
	fallbackCfi: string | undefined,
	align: 'nearest' | 'center',
): Promise<boolean> {
	const cfi =
		(range ? cfiFromDomRange(rend, range)?.trim() : '') ||
		fallbackCfi?.trim() ||
		'';
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
		return align === 'center'
			? scrollEpubDomRangeToCenter(rend, resolved)
			: scrollEpubDomRangeIntoView(rend, resolved);
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

/**
 * 连续滚动：滚动到顶/底时自动衔接相邻 spine（优先 manager.check，回退 prev/next）
 * 用于 EPUB 连续阅读时，滚动触达顶部/底部时自动切换上一章/下一章，实现无缝章节浏览体验
 * @param rend        epub.js 的 Rendition 实例
 * @param isDestroyed 用于判断组件/实例是否已卸载的函数（避免已销毁后回调）
 * @returns           清理事件监听的回调函数
 */
export function attachEpubScrolledEdgeNav(
	rend: Rendition,
	isDestroyed: () => boolean,
): () => void {
	// 获取连续滚动容器（主滚动 div）
	const container = getEpubScrollContainer(rend);
	// 若没有容器（如非连续滚动模式），直接返回空卸载函数
	if (!container) return () => {};

	// busy 标志表示当前是否正处理章节切换，避免重复触发
	let busy = false;
	// cooldownUntil 标记下次允许 edge 触发的时间戳（ms），用于冷却防止连发
	let cooldownUntil = 0;

	/**
	 * 执行章节边缘切换动作（到顶调用 prev，到底调用 next）
	 * - 优先调用底层 manager.check 方法（可定制逻辑），如无则直接 prev/next 跳转
	 * - 冷却防抖，busy 防再入
	 * @param action 'prev' 表示上一章节，'next' 表示下一章节
	 * @param e      事件对象（如传入则 preventDefault 阻止默认滚动行为）
	 */
	const runEdgeAction = (action: 'prev' | 'next', e?: Event) => {
		// 若组件已销毁、正在忙、仍在冷却期内，直接跳过
		if (isDestroyed() || busy || Date.now() < cooldownUntil) return;
		// 阻止默认行为（如 native 滚动）
		e?.preventDefault();

		// 标记为 busy，进入冷却期 EDGE_COOLDOWN_MS 毫秒
		busy = true;
		cooldownUntil = Date.now() + EDGE_COOLDOWN_MS;

		// 获取 epub manager 实例
		const manager = getManager(rend);
		// 优先调用 manager.check（如 ContinuousViewManager.check 可自定义切换逻辑），否则直接 prev/next
		const task = manager?.check
			? Promise.resolve(manager.check())
			: Promise.resolve(action === 'next' ? rend.next() : rend.prev());

		// 忽略任务异常（如无更多章节），任务完成后 busy 重置，允许下次触发
		void task
			.catch(() => undefined)
			.finally(() => {
				busy = false;
			});
	};

	/**
	 * wheel 事件处理：检测鼠标滚轮触顶/底时自动切换章节
	 * - dy > 0 为向下滚动（检查是否已到容器底部 atBottom）
	 * - dy < 0 为向上滚动（检查是否已到容器顶部 atTop）
	 * - 若未触及边缘不处理
	 */
	const onWheel = (e: WheelEvent) => {
		const dy = e.deltaY;
		// 没有实际滚动（水平或无滚动）直接返回
		if (dy === 0) return;

		// 检查当前容器是否已在顶/底边界（带一定像素容差）
		const { atTop, atBottom } = scrollEdges(container);
		// 向下且已到底部，触发下一章节
		if (dy > 0 && atBottom) runEdgeAction('next', e);
		// 向上且已到顶部，触发上一章节
		else if (dy < 0 && atTop) runEdgeAction('prev', e);
	};

	// 注册 wheel 事件监听，passive: false 以便在回调内阻止默认行为
	container.addEventListener('wheel', onWheel, { passive: false });

	// 返回卸载函数，用于移除 wheel 事件监听（通常组件卸载时调用）
	return () => {
		container.removeEventListener('wheel', onWheel);
	};
}
