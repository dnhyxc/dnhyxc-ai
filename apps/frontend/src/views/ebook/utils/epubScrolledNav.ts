import type { Rendition } from 'epubjs';

const SCROLL_EDGE_PX = 16;
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
