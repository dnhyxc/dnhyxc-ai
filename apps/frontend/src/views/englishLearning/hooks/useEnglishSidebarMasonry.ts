import { type RefObject, useLayoutEffect } from 'react';

function supportsNativeMasonry(): boolean {
	return (
		CSS.supports('display', 'grid-lanes') ||
		CSS.supports('grid-template-rows', 'masonry')
	);
}

/**
 * 侧栏卡片瀑布流：保持 DOM 顺序，用 grid-row span 填补行高空白。
 * 支持原生 grid-lanes / masonry 时不跑 JS。
 */
export function useEnglishSidebarMasonry(
	rootRef: RefObject<HTMLElement | null>,
) {
	useLayoutEffect(() => {
		const root = rootRef.current;
		if (!root || supportsNativeMasonry()) return;

		let raf = 0;
		const relayout = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const items = Array.from(root.children) as HTMLElement[];
				for (const el of items) {
					el.style.gridRowEnd = 'auto';
				}
				for (const el of items) {
					const mb = Number.parseFloat(getComputedStyle(el).marginBottom) || 0;
					const h = el.getBoundingClientRect().height + mb;
					el.style.gridRowEnd = `span ${Math.max(1, Math.ceil(h))}`;
				}
			});
		};

		relayout();
		const ro = new ResizeObserver(relayout);
		ro.observe(root);
		for (const child of root.children) {
			ro.observe(child);
		}

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			for (const el of Array.from(root.children) as HTMLElement[]) {
				el.style.gridRowEnd = '';
			}
		};
	}, [rootRef]);
}
