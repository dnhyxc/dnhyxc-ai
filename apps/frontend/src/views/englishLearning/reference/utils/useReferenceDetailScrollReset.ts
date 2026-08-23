import { type RefObject, useLayoutEffect, useRef } from 'react';

/** 左侧导航切换时把右侧 ScrollArea viewport 滚回顶部 */
export function useReferenceDetailScrollReset(
	scrollKey: string,
): RefObject<HTMLDivElement | null> {
	const ref = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const vp = ref.current;
		if (!vp) return;
		vp.scrollTop = 0;
		vp.scrollLeft = 0;
	}, [scrollKey]);
	return ref;
}
