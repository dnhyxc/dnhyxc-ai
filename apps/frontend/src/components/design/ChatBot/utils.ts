/**
 * 聊天分支切换后钉住视口滚动位置：与 ChatBot 消息行 DOM（#message-*、[data-message-branch-anchor]）配套。
 */

export type BranchScrollPending = {
	kind: 'anchorTop' | 'rowBottom';
	before: number;
	nextRowId: string;
	seq: number;
};

/**
 * 行高 ≥ 视口一半时视为「长消息」：分支操作在气泡底部，若仍用钉锚点 top 会滚到对齐气泡上沿，操作区被顶到视口上方。
 * 此时改为把整条 #message-row 的底边与 ScrollArea viewport 底边对齐（只滚外层 scrollContainerRef）。
 */
const LONG_ROW_VIEWPORT_HEIGHT_RATIO = 0.5;

/** 底下仍有后续消息时：钉视口目标略偏上（仅短消息路径） */
export const BRANCH_ANCHOR_NUDGE_UP_PX = 20;

/** 滚动容器合法 scrollTop 上限（勿用 scrollHeight+N 依赖浏览器钳位） */
export function getMaxScrollTop(el: HTMLElement) {
	return Math.max(0, el.scrollHeight - el.clientHeight);
}

export function alignMessageRowBottomToViewportBottom(
	sc: HTMLElement,
	rowId: string,
) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return;
	const delta =
		row.getBoundingClientRect().bottom - sc.getBoundingClientRect().bottom;
	if (Math.abs(delta) > 0.5) sc.scrollTop += delta;
}

export function isLongMessageRowForBranchScroll(sc: HTMLElement, rowId: string) {
	const row = sc.querySelector(`#message-${rowId}`);
	if (!(row instanceof HTMLElement)) return false;
	return (
		row.getBoundingClientRect().height >=
		sc.clientHeight * LONG_ROW_VIEWPORT_HEIGHT_RATIO
	);
}

/**
 * 分支切换后按锚点修正 scrollTop 一次。
 * 返回 true：可结束本次钉视口（成功对齐或 seq 已过期）；false：DOM 尚未就绪，可交给 useLayoutEffect 再试。
 */
export function tryApplyBranchScrollAnchor(
	sc: HTMLElement,
	pending: BranchScrollPending,
	currentSeq: number,
): boolean {
	if (pending.seq !== currentSeq) return true;
	const r = sc.querySelector(`#message-${pending.nextRowId}`);
	if (!(r instanceof HTMLElement)) return false;
	let d = 0;
	if (pending.kind === 'anchorTop') {
		const a = r.querySelector('[data-message-branch-anchor]');
		if (!(a instanceof HTMLElement)) return false;
		d = a.getBoundingClientRect().top - pending.before;
	} else {
		d = r.getBoundingClientRect().bottom - pending.before;
	}
	if (Math.abs(d) > 0.5) sc.scrollTop += d;
	return true;
}
