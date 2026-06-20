import { Popover, PopoverAnchor, PopoverContent } from '@ui/index';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { EpubSelectionPopBarPayload } from '../utils/epubSelectionToolbarAttach';
import {
	EpubQuoteActionBar,
	type EpubQuoteActionBarLabels,
} from './EpubQuoteActionBar';

export type EpubSelectionPopBarState = EpubSelectionPopBarPayload & {
	open: boolean;
};

export type EpubSelectionPopBarLabels = EpubQuoteActionBarLabels;

type Props = {
	state: EpubSelectionPopBarState | null;
	labels: EpubSelectionPopBarLabels;
	onCopy: () => void;
	onWriteThought: () => void;
	onAskBook: () => void;
	/** 任意操作点击后清除 EPUB 选区 */
	onClearSelection?: () => void;
};

const ARROW_EDGE_PADDING = 10;
const ARROW_WIDTH = 14;
const ARROW_HEIGHT = 7;

function clampArrowLeft(
	toolbarLeft: number,
	toolbarWidth: number,
	anchorX: number,
) {
	const min = ARROW_EDGE_PADDING;
	const max = toolbarWidth - ARROW_EDGE_PADDING;
	return Math.max(min, Math.min(max, anchorX - toolbarLeft));
}

function PopBarCaret({ left }: { left: number }) {
	return (
		<>
			<svg
				aria-hidden
				className={cn(
					'pointer-events-none absolute -translate-x-1/2',
					'top-[calc(100%-1px)]',
					'group-data-[side=bottom]/pop:hidden',
				)}
				style={{ left }}
				width={ARROW_WIDTH}
				height={ARROW_HEIGHT}
				viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
			>
				<title>Caret</title>
				<path
					d={`M0 0 H${ARROW_WIDTH} L${ARROW_WIDTH / 2} ${ARROW_HEIGHT} Z`}
					fill="color-mix(in oklch, var(--theme-card) 95%, transparent)"
				/>
			</svg>
			<svg
				aria-hidden
				className={cn(
					'pointer-events-none absolute hidden -translate-x-1/2',
					'bottom-[calc(100%-1px)]',
					'group-data-[side=bottom]/pop:block',
				)}
				style={{ left }}
				width={ARROW_WIDTH}
				height={ARROW_HEIGHT}
				viewBox={`0 0 ${ARROW_WIDTH} ${ARROW_HEIGHT}`}
			>
				<title>Caret</title>
				<path
					d={`M0 ${ARROW_HEIGHT} H${ARROW_WIDTH} L${ARROW_WIDTH / 2} 0 Z`}
					fill="color-mix(in oklch, var(--theme-card) 95%, transparent)"
				/>
			</svg>
		</>
	);
}

/**
 * 选区上方浮动操作条（Pop Sidebar）。
 * 锚点 + Radix Popover 碰撞检测，与 EpubReaderContextMenu 相同，避免贴边溢出。
 */
export function EpubSelectionPopBar({
	state,
	labels,
	onCopy,
	onWriteThought,
	onAskBook,
	onClearSelection,
}: Props) {
	const toolbarRef = useRef<HTMLDivElement>(null);
	const isPlacedRef = useRef(false);
	const [layout, setLayout] = useState<{ arrowLeft: number } | null>(null);

	const anchorStyle = useMemo(
		() =>
			state
				? ({
						position: 'fixed',
						left: state.x,
						top: state.y,
						width: 1,
						height: 1,
						pointerEvents: 'none',
					} as const)
				: undefined,
		[state],
	);

	const measureArrowLeft = useCallback((): number | null => {
		const toolbar = toolbarRef.current;
		if (!toolbar || !state?.open) return null;
		const rect = toolbar.getBoundingClientRect();
		if (rect.width === 0) return null;
		return clampArrowLeft(rect.left, rect.width, state.x);
	}, [state?.open, state?.x]);

	useLayoutEffect(() => {
		if (!state?.open) {
			isPlacedRef.current = false;
			setLayout(null);
			return;
		}

		isPlacedRef.current = false;
		setLayout(null);

		let cancelled = false;
		let rafId = 0;
		let frame = 0;

		const settlePlacement = () => {
			if (cancelled) return;
			frame += 1;
			if (frame < 8) {
				rafId = requestAnimationFrame(settlePlacement);
				return;
			}
			const arrowLeft = measureArrowLeft();
			if (arrowLeft == null) return;
			isPlacedRef.current = true;
			setLayout({ arrowLeft });
		};

		rafId = requestAnimationFrame(settlePlacement);

		const onRelayout = () => {
			if (!isPlacedRef.current) return;
			const arrowLeft = measureArrowLeft();
			if (arrowLeft == null) return;
			setLayout({ arrowLeft });
		};

		window.addEventListener('resize', onRelayout);

		const toolbarEl = toolbarRef.current;
		let observer: ResizeObserver | null = null;
		if (toolbarEl) {
			observer = new ResizeObserver(onRelayout);
			observer.observe(toolbarEl);
		}

		return () => {
			cancelled = true;
			cancelAnimationFrame(rafId);
			window.removeEventListener('resize', onRelayout);
			observer?.disconnect();
		};
	}, [state?.open, state?.x, measureArrowLeft]);

	if (!state?.open) return null;

	return (
		<Popover open={state.open}>
			<PopoverAnchor asChild>
				<span aria-hidden style={anchorStyle} />
			</PopoverAnchor>
			<PopoverContent
				side="top"
				align="center"
				sideOffset={10}
				collisionPadding={12}
				className={cn(
					'group/pop z-50 w-auto border-0 bg-transparent p-0 shadow-none outline-none',
					!layout && 'pointer-events-none opacity-0',
				)}
				onOpenAutoFocus={(e) => e.preventDefault()}
				onCloseAutoFocus={(e) => e.preventDefault()}
				onMouseDown={(e) => e.preventDefault()}
			>
				<div className="relative drop-shadow-(--shadow-6)">
					<div
						ref={toolbarRef}
						className="rounded-md bg-[color-mix(in_oklch,var(--theme-card)_92%,transparent)] backdrop-blur-md backdrop-saturate-150"
					>
						<EpubQuoteActionBar
							variant="floating"
							labels={labels}
							onCopy={onCopy}
							onWriteThought={onWriteThought}
							onAskBook={onAskBook}
							onAnyAction={onClearSelection}
						/>
					</div>
					{layout ? <PopBarCaret left={layout.arrowLeft} /> : null}
				</div>
			</PopoverContent>
		</Popover>
	);
}
