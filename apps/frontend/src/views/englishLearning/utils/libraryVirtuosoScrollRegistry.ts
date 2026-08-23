import type { VirtuosoHandle } from 'react-virtuoso';

const handlesByViewport = new WeakMap<HTMLElement, VirtuosoHandle>();

export function registerLibraryVirtuosoScrollParent(
	viewport: HTMLElement,
	handle: VirtuosoHandle,
): () => void {
	handlesByViewport.set(viewport, handle);
	return () => {
		if (handlesByViewport.get(viewport) === handle) {
			handlesByViewport.delete(viewport);
		}
	};
}

function getVirtuosoHandle(
	viewport: HTMLElement | null,
): VirtuosoHandle | undefined {
	if (!viewport) return undefined;
	return handlesByViewport.get(viewport);
}

/** 程序化滚动须走 VirtuosoHandle，否则 customScrollParent 下易出现空白区 */
export function scrollLibraryListViewport(
	viewport: HTMLElement,
	top: number,
	behavior: 'auto' | 'smooth' = 'auto',
): void {
	const handle = getVirtuosoHandle(viewport);
	if (handle) {
		handle.scrollTo({ top, behavior });
		return;
	}
	viewport.scrollTo({ top, behavior });
	notifyScrollParent(viewport);
}

export function scrollLibraryListViewportToTop(
	viewport: HTMLElement,
	behavior: 'auto' | 'smooth' = 'smooth',
): void {
	const handle = getVirtuosoHandle(viewport);
	if (handle) {
		handle.scrollToIndex({ index: 0, align: 'start', behavior });
		return;
	}
	viewport.scrollTo({ top: 0, behavior });
	notifyScrollParent(viewport);
}

function notifyScrollParent(viewport: HTMLElement): void {
	requestAnimationFrame(() => {
		viewport.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
}
