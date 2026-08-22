import { type RefObject, useEffect, useState } from 'react';

export type LibraryGridColumnMode = 'vocab' | 'classic';

const VOCAB_COL_MIN_PX = 256;
const VOCAB_GAP_PX = 16;
/** 与 classic 列表 `@min-[28rem]:grid-cols-2` 对齐（28rem @ 16px） */
const CLASSIC_TWO_COL_MIN_PX = 448;

export function useLibraryGridColumns(
	viewportRef: RefObject<HTMLDivElement | null>,
	mode: LibraryGridColumnMode,
) {
	const [columns, setColumns] = useState(1);

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;

		const update = () => {
			const width = el.clientWidth;
			if (mode === 'classic') {
				setColumns(width >= CLASSIC_TWO_COL_MIN_PX ? 2 : 1);
				return;
			}
			setColumns(
				Math.max(
					1,
					Math.floor(
						(width + VOCAB_GAP_PX) / (VOCAB_COL_MIN_PX + VOCAB_GAP_PX),
					),
				),
			);
		};

		update();
		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => ro.disconnect();
	}, [mode, viewportRef]);

	return columns;
}
