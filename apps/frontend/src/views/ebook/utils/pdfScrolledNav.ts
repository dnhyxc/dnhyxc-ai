/** 须几乎贴边（px）才视为到达顶/底 */
const SCROLL_EDGE_PX = 2;
/** 滚轮意图阈值，过滤触控板微抖 */
const MIN_WHEEL_DELTA = 28;
/** 滚动停稳后多久才允许边缘翻页（避免猛滚惯性连跳） */
const SCROLL_STABLE_MS = 220;
const EDGE_COOLDOWN_MS = 600;

export type PdfScrollEdgeNavHandlers = {
	canPrev: () => boolean;
	canNext: () => boolean;
	onPrev: () => void;
	onNext: () => void;
	isDisabled?: () => boolean;
};

function scrollEdges(container: HTMLElement) {
	const { scrollTop, scrollHeight, clientHeight } = container;
	const noScroll = scrollHeight <= clientHeight + SCROLL_EDGE_PX * 2;
	return {
		noScroll,
		atTop: noScroll || scrollTop <= SCROLL_EDGE_PX,
		atBottom:
			noScroll || scrollTop + clientHeight >= scrollHeight - SCROLL_EDGE_PX,
	};
}

/** PDF 单页滚动：滚到顶/底停稳后，再滚一下才衔接上一页/下一页 */
export function attachPdfScrolledEdgeNav(
	container: HTMLElement,
	handlers: PdfScrollEdgeNavHandlers,
): () => void {
	let cooldownUntil = 0;
	let stableAtTop = false;
	let stableAtBottom = false;
	let stableTimer: ReturnType<typeof setTimeout> | null = null;

	const resetStableEdges = () => {
		stableAtTop = false;
		stableAtBottom = false;
	};

	const scheduleStableEdges = () => {
		const { noScroll } = scrollEdges(container);
		if (noScroll) {
			stableAtTop = true;
			stableAtBottom = true;
			return;
		}

		resetStableEdges();
		if (stableTimer) clearTimeout(stableTimer);
		stableTimer = setTimeout(() => {
			stableTimer = null;
			const edges = scrollEdges(container);
			if (edges.atTop) stableAtTop = true;
			if (edges.atBottom) stableAtBottom = true;
		}, SCROLL_STABLE_MS);
	};

	const runEdgeAction = (action: 'prev' | 'next', e?: Event) => {
		if (Date.now() < cooldownUntil) return;
		if (handlers.isDisabled?.()) return;
		if (action === 'prev' && !handlers.canPrev()) return;
		if (action === 'next' && !handlers.canNext()) return;

		e?.preventDefault();
		cooldownUntil = Date.now() + EDGE_COOLDOWN_MS;
		resetStableEdges();

		if (action === 'next') handlers.onNext();
		else handlers.onPrev();
	};

	const onScroll = () => {
		scheduleStableEdges();
	};

	const onWheel = (e: WheelEvent) => {
		const dy = e.deltaY;
		if (Math.abs(dy) < MIN_WHEEL_DELTA) return;

		const { noScroll, atTop, atBottom } = scrollEdges(container);

		if (noScroll) {
			if (dy > 0 && atBottom) runEdgeAction('next', e);
			else if (dy < 0 && atTop) runEdgeAction('prev', e);
			return;
		}

		// 说明：须先滚到边缘并停稳，再划一下才翻页；猛滚惯性不会连跳
		if (dy > 0 && atBottom && stableAtBottom) runEdgeAction('next', e);
		else if (dy < 0 && atTop && stableAtTop) runEdgeAction('prev', e);
	};

	scheduleStableEdges();
	container.addEventListener('scroll', onScroll, { passive: true });
	container.addEventListener('wheel', onWheel, { passive: false });

	return () => {
		if (stableTimer) clearTimeout(stableTimer);
		container.removeEventListener('scroll', onScroll);
		container.removeEventListener('wheel', onWheel);
	};
}
