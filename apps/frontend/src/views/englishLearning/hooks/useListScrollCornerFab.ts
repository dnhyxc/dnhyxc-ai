/**
 * 英语学习列表：右下角置顶/置底浮动按钮状态（可滚动时置底，触底后置顶）。
 */
import type { ScrollFabMode } from '@design/Assistant';
import {
	type RefObject,
	type UIEventHandler,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import {
	scrollLibraryListViewport,
	scrollLibraryListViewportToTop,
} from '../utils/libraryVirtuosoScrollRegistry';

const BOTTOM_THRESHOLD_PX = 8;
const MIN_SCROLLABLE_PX = 4;
/** 与 LibraryVirtuosoGrid atBottomThreshold 保持一致 */
export const LIBRARY_LIST_AT_BOTTOM_THRESHOLD_PX = 200;
/** 大于 atBottomThreshold，FAB 置底停在加载区外 */
const FAB_BOTTOM_INSET_PX = LIBRARY_LIST_AT_BOTTOM_THRESHOLD_PX + 80;
/** 上滑超过锚点该距离后，解除 FAB 置底停靠（恢复常规触底判定） */
const FAB_ANCHOR_RELEASE_PX = 48;

let fabAnchorPinned = false;

export function setListScrollFabAnchorPinned(pinned: boolean): void {
	fabAnchorPinned = pinned;
}

/** Virtuoso endReached 按可见区判断；FAB 停靠在加载区外时拦截，手动滚入加载区后放开 */
export function shouldBlockLibraryListEndReached(vp: HTMLElement): boolean {
	if (!fabAnchorPinned) return false;
	const maxScroll = Math.max(0, vp.scrollHeight - vp.clientHeight);
	const inLoadZone =
		vp.scrollTop >= maxScroll - LIBRARY_LIST_AT_BOTTOM_THRESHOLD_PX;
	return !inLoadZone;
}

function getFabBottomAnchor(vp: HTMLElement): number {
	const maxScroll = Math.max(0, vp.scrollHeight - vp.clientHeight);
	if (maxScroll <= MIN_SCROLLABLE_PX) return 0;
	const inset = Math.min(
		FAB_BOTTOM_INSET_PX,
		Math.max(0, maxScroll - MIN_SCROLLABLE_PX),
	);
	return maxScroll - inset;
}

export function composeViewportScroll(
	...handlers: Array<UIEventHandler<HTMLDivElement> | undefined>
): UIEventHandler<HTMLDivElement> {
	return (e) => {
		for (const handler of handlers) handler?.(e);
	};
}

export function useListScrollCornerFab(
	viewportRef: RefObject<HTMLDivElement | null>,
	contentKey?: unknown,
	enabled = true,
) {
	const [mode, setMode] = useState<ScrollFabMode>('hidden');
	const modeRef = useRef<ScrollFabMode>('hidden');

	const updateMode = useCallback(() => {
		if (!enabled) {
			setListScrollFabAnchorPinned(false);
			if (modeRef.current !== 'hidden') {
				modeRef.current = 'hidden';
				setMode('hidden');
			}
			return;
		}
		const vp = viewportRef.current;
		if (!vp) return;
		const maxScroll = Math.max(0, vp.scrollHeight - vp.clientHeight);
		const anchor = getFabBottomAnchor(vp);
		const atTrueBottom = vp.scrollTop >= maxScroll - BOTTOM_THRESHOLD_PX;
		const atFabAnchor = vp.scrollTop >= anchor - BOTTOM_THRESHOLD_PX;
		const inLoadZone =
			vp.scrollTop >= maxScroll - LIBRARY_LIST_AT_BOTTOM_THRESHOLD_PX;

		if (fabAnchorPinned && vp.scrollTop < anchor - FAB_ANCHOR_RELEASE_PX) {
			setListScrollFabAnchorPinned(false);
		}
		if (atTrueBottom || inLoadZone) {
			setListScrollFabAnchorPinned(false);
		}

		let next: ScrollFabMode = 'hidden';
		if (maxScroll > MIN_SCROLLABLE_PX) {
			if (atTrueBottom || (fabAnchorPinned && atFabAnchor)) {
				next = 'toTop';
			} else {
				next = 'toBottom';
			}
		}
		if (modeRef.current === next) return;
		modeRef.current = next;
		setMode(next);
	}, [enabled, viewportRef]);

	const onScrollCornerFab = useCallback<UIEventHandler<HTMLDivElement>>(() => {
		updateMode();
	}, [updateMode]);

	const onScrollCornerFabClick = useCallback(() => {
		const vp = viewportRef.current;
		if (!vp) return;
		if (modeRef.current === 'toBottom') {
			setListScrollFabAnchorPinned(true);
			const top = getFabBottomAnchor(vp);
			scrollLibraryListViewport(vp, top, 'auto');
			modeRef.current = 'toTop';
			setMode('toTop');
		} else if (modeRef.current === 'toTop') {
			setListScrollFabAnchorPinned(false);
			scrollLibraryListViewportToTop(vp, 'smooth');
		}
	}, [viewportRef]);

	useEffect(() => {
		if (!enabled) {
			setListScrollFabAnchorPinned(false);
			modeRef.current = 'hidden';
			setMode('hidden');
			return;
		}
		let ro: ResizeObserver | null = null;
		const tid = window.setTimeout(() => {
			updateMode();
			requestAnimationFrame(updateMode);
			const vp = viewportRef.current;
			if (vp) {
				ro = new ResizeObserver(() => updateMode());
				ro.observe(vp);
			}
		}, 0);
		return () => {
			window.clearTimeout(tid);
			ro?.disconnect();
		};
	}, [contentKey, enabled, updateMode, viewportRef]);

	return { mode, onScrollCornerFab, onScrollCornerFabClick };
}
