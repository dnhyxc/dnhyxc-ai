import Tooltip from '@design/Tooltip';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Button, ScrollArea, Spinner } from '@ui/index';
import {
	GripVertical,
	LocateFixed,
	SquarePause,
	SquarePlay,
	SquareStop,
} from 'lucide-react';
import {
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { SelectionSpeakStatus } from './useSelectionSpeak';

const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3] as const;
const EDGE_PAD = 12;
const MIN_W = 200;
const MIN_H = 40;
/** 达到此高度：上文本 + 下操作的纵向布局 */
const STACK_H = 72;
/** 超过该位移才视为真正拖离默认位（避免仅按下就出现回位按钮） */
const MOVE_EPS = 3;
/** Layout 根节点；拖动/缩放边界用整页壳，不限助手侧栏 */
const LAYOUT_BOUNDS_SEL = '[data-app-layout]';

type Pos = { left: number; top: number };
type Size = { w: number; h: number };

/** 未指定时的初始宽（约等于原 22rem） */
const DEFAULT_W = 352;

export type SelectionSpeakBarSizeProps = {
	/** 初始宽度（px）；与 initialHeight 任一传入即启用像素尺寸 */
	initialWidth?: number;
	/** 初始高度（px） */
	initialHeight?: number;
	/**
	 * 四角拖拽缩放开关；未传或某角省略视为开启。
	 * 例：`{ nw: false }` 只关左上，其余仍开。
	 */
	resizeHandles?: SelectionSpeakResizeHandles;
};

/** 四角缩放把手：nw 左上 / ne 右上 / sw 左下 / se 右下 */
export type SelectionSpeakResizeHandles = {
	nw?: boolean;
	ne?: boolean;
	sw?: boolean;
	se?: boolean;
};

type Props = {
	status: SelectionSpeakStatus;
	rate: number;
	preview: string;
	onTogglePlay: () => void;
	onStop: () => void;
	onRateChange: (rate: number) => void;
	/** 未传 initialWidth/Height 时的默认宽度 class */
	width?: string;
} & SelectionSpeakBarSizeProps;

function resolveResizeHandles(
	handles?: SelectionSpeakResizeHandles,
): Required<SelectionSpeakResizeHandles> {
	return {
		nw: handles?.nw !== false,
		ne: handles?.ne !== false,
		sw: handles?.sw !== false,
		se: handles?.se !== false,
	};
}

function resolveBoundsEl(): HTMLElement {
	return (
		document.querySelector<HTMLElement>(LAYOUT_BOUNDS_SEL) ??
		document.documentElement
	);
}

function formatRate(rate: number): string {
	return `${rate.toFixed(1)} X`;
}

function resolveInitialSize(
	initialWidth?: number,
	initialHeight?: number,
): Size | null {
	if (initialWidth == null && initialHeight == null) return null;
	return {
		w: Math.max(MIN_W, initialWidth ?? DEFAULT_W),
		h: Math.max(MIN_H, initialHeight ?? MIN_H),
	};
}

/** 固定槽位展示当前句；矮条横向滚，纵向布局时多行换行 */
function SpeakPreview({ text, stacked }: { text: string; stacked: boolean }) {
	const display = text.trim() || '......';

	if (stacked) {
		return (
			<ScrollArea
				key={display}
				scrollbars="vertical"
				className="pt-1 text-textcolor/90 min-h-0 min-w-0 w-full flex-1 text-sm"
				// 距右缘 1px，不完全贴边
				scrollbarClassName="w-1.5 border-0 py-0 pr-px pl-0"
				viewportClassName="pl-1.5 pr-2"
				onPointerDown={(e) => e.stopPropagation()}
			>
				<span className="px-[7px] block whitespace-pre-wrap wrap-break-word leading-relaxed">
					{display}
				</span>
			</ScrollArea>
		);
	}

	return (
		<ScrollArea
			key={display}
			scrollbars="horizontal"
			className="text-textcolor/80 px-2 box-border h-8 min-w-0 flex-1 text-sm pb-0.5"
			scrollbarClassName="pointer-events-none h-0 border-0 opacity-0"
			viewportClassName="flex items-center [&>div]:flex-row! [&>div]:items-center! [&>div]:flex-nowrap!"
			onPointerDown={(e) => e.stopPropagation()}
			onWheel={(e) => {
				const viewport = e.currentTarget;
				if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
				if (viewport.scrollWidth <= viewport.clientWidth + 2) return;
				e.preventDefault();
				viewport.scrollLeft += e.deltaY;
			}}
		>
			<span className="inline-block whitespace-nowrap">{display}</span>
		</ScrollArea>
	);
}

/** fixed 坐标：限制在 bounds 视口矩形内 */
function clampFixed(
	left: number,
	top: number,
	barW: number,
	barH: number,
	box: DOMRect,
): Pos {
	const maxLeft = Math.max(box.left + EDGE_PAD, box.right - barW - EDGE_PAD);
	const maxTop = Math.max(box.top + EDGE_PAD, box.bottom - barH - EDGE_PAD);
	return {
		left: Math.min(maxLeft, Math.max(box.left + EDGE_PAD, left)),
		top: Math.min(maxTop, Math.max(box.top + EDGE_PAD, top)),
	};
}

function clampSize(
	w: number,
	h: number,
	box: DOMRect,
	left: number,
	top: number,
): Size {
	const maxW = Math.max(MIN_W, box.right - EDGE_PAD - left);
	const maxH = Math.max(MIN_H, box.bottom - EDGE_PAD - top);
	return {
		w: Math.min(maxW, Math.max(MIN_W, w)),
		h: Math.min(maxH, Math.max(MIN_H, h)),
	};
}

/** 右上角缩放：左边与底边固定，向右上拉大 */
function clampSizeNe(
	w: number,
	h: number,
	box: DOMRect,
	left: number,
	bottom: number,
): { size: Size; top: number } {
	const maxW = Math.max(MIN_W, box.right - EDGE_PAD - left);
	const maxH = Math.max(MIN_H, bottom - (box.top + EDGE_PAD));
	const size = {
		w: Math.min(maxW, Math.max(MIN_W, w)),
		h: Math.min(maxH, Math.max(MIN_H, h)),
	};
	return { size, top: bottom - size.h };
}

/** 左上角缩放：右边与底边固定，向左上拉大 */
function clampSizeNw(
	w: number,
	h: number,
	box: DOMRect,
	right: number,
	bottom: number,
): { size: Size; left: number; top: number } {
	const maxW = Math.max(MIN_W, right - (box.left + EDGE_PAD));
	const maxH = Math.max(MIN_H, bottom - (box.top + EDGE_PAD));
	const size = {
		w: Math.min(maxW, Math.max(MIN_W, w)),
		h: Math.min(maxH, Math.max(MIN_H, h)),
	};
	return { size, left: right - size.w, top: bottom - size.h };
}

/** 左下角缩放：右边与顶边固定，向左下拉大 */
function clampSizeSw(
	w: number,
	h: number,
	box: DOMRect,
	right: number,
	top: number,
): { size: Size; left: number } {
	const maxW = Math.max(MIN_W, right - (box.left + EDGE_PAD));
	const maxH = Math.max(MIN_H, box.bottom - EDGE_PAD - top);
	const size = {
		w: Math.min(maxW, Math.max(MIN_W, w)),
		h: Math.min(maxH, Math.max(MIN_H, h)),
	};
	return { size, left: right - size.w };
}

type ResizeCorner = 'se' | 'ne' | 'sw' | 'nw';

/**
 * 选区朗读悬浮条。
 * 默认：挂在 Footer 内，用 bottom-full + mb-3 贴在输入框上方居中。
 * 拖动后改为 fixed，并限制在 Layout（[data-app-layout]）内。
 * 四角可拖改宽高（由 resizeHandles 控制，默认全开）。
 */
export function SelectionSpeakBar({
	status,
	rate,
	preview,
	onTogglePlay,
	onStop,
	onRateChange,
	width = 'w-[min(100%-1.5rem,21rem)]',
	initialWidth,
	initialHeight,
	resizeHandles,
}: Props) {
	const { t } = useI18n();
	const handles = resolveResizeHandles(resizeHandles);
	const barRef = useRef<HTMLDivElement>(null);
	/** null = 未拖过，走 Footer 锚点默认位 */
	const [fixedPos, setFixedPos] = useState<Pos | null>(null);
	const fixedPosRef = useRef<Pos | null>(null);

	/** null = 未设尺寸，走默认 class 宽 + 内容高 */
	const [size, setSize] = useState<Size | null>(() =>
		resolveInitialSize(initialWidth, initialHeight),
	);
	const sizeRef = useRef<Size | null>(
		resolveInitialSize(initialWidth, initialHeight),
	);

	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		originLeft: number;
		originTop: number;
		barW: number;
		barH: number;
		box: DOMRect;
		/** 按下时是否仍在 Footer 默认锚点 */
		startedFromDefault: boolean;
		moved: boolean;
	} | null>(null);

	const resizeRef = useRef<{
		pointerId: number;
		corner: ResizeCorner;
		startX: number;
		startY: number;
		originW: number;
		originH: number;
		left: number;
		top: number;
		bottom: number;
		right: number;
		box: DOMRect;
	} | null>(null);

	/** 拖动手势进行中：仅用于 fixed 样式，不表示已离开默认位 */
	const [dragActive, setDragActive] = useState(false);

	// 仅空闲时用 state 回写 ref；拖动/缩放中 preview 等重渲染不得把 ref 打回旧坐标
	useEffect(() => {
		if (dragRef.current || resizeRef.current) return;
		fixedPosRef.current = fixedPos;
	}, [fixedPos]);

	useEffect(() => {
		if (dragRef.current || resizeRef.current) return;
		sizeRef.current = size;
	}, [size]);

	const applyFixedStyle = useCallback((pos: Pos) => {
		const el = barRef.current;
		if (!el) return;
		el.style.left = `${pos.left}px`;
		el.style.top = `${pos.top}px`;
	}, []);

	const applySizeStyle = useCallback((next: Size) => {
		const el = barRef.current;
		if (!el) return;
		el.style.width = `${next.w}px`;
		el.style.height = `${next.h}px`;
	}, []);

	/** 已提交的离位坐标；ResizeObserver 只跟这个走 */
	const isDockedAway = fixedPos != null;
	/** 视觉上是否 fixed（含正在拖、尚未超过阈值的按下） */
	const isFixedVisual = isDockedAway || dragActive;

	useEffect(() => {
		if (!isDockedAway) return;
		const boxEl = resolveBoundsEl();
		const ro = new ResizeObserver(() => {
			// 拖动/缩放中忽略，避免与手势坐标打架或弹回起点
			if (dragRef.current || resizeRef.current) return;
			const box = resolveBoundsEl().getBoundingClientRect();
			const bar = barRef.current?.getBoundingClientRect();
			const prev = fixedPosRef.current;
			if (!bar || !prev) return;
			const sz = sizeRef.current;
			const barW = sz?.w ?? bar.width;
			const barH = sz?.h ?? bar.height;
			if (sz) {
				const nextSize = clampSize(sz.w, sz.h, box, prev.left, prev.top);
				sizeRef.current = nextSize;
				applySizeStyle(nextSize);
				setSize(nextSize);
			}
			const next = clampFixed(prev.left, prev.top, barW, barH, box);
			fixedPosRef.current = next;
			applyFixedStyle(next);
			setFixedPos(next);
		});
		ro.observe(boxEl);
		return () => ro.disconnect();
	}, [isDockedAway, applyFixedStyle, applySizeStyle]);

	/** 清 fixed 坐标与缩放尺寸，回到 Footer 默认锚点与初始宽高 */
	const resetToDefault = useCallback(() => {
		dragRef.current = null;
		resizeRef.current = null;
		fixedPosRef.current = null;
		setDragActive(false);
		const nextSize = resolveInitialSize(initialWidth, initialHeight);
		sizeRef.current = nextSize;
		const el = barRef.current;
		if (el) {
			el.classList.add(
				'absolute',
				'bottom-full',
				'left-1/2',
				'mb-[9px]',
				'-translate-x-1/2',
			);
			el.classList.remove('fixed');
			el.style.left = '';
			el.style.top = '';
			if (nextSize) {
				el.style.width = `${nextSize.w}px`;
				el.style.height = `${nextSize.h}px`;
			} else {
				el.style.width = '';
				el.style.height = '';
			}
		}
		setSize(nextSize);
		setFixedPos(null);
	}, [initialWidth, initialHeight]);

	/** 仅切到 fixed DOM；不 setState，避免「只按下」就显示回位按钮 */
	const promoteToFixed = useCallback(
		(bar: HTMLDivElement, barRect: DOMRect, box: DOMRect): Pos => {
			const current =
				fixedPosRef.current ??
				clampFixed(
					barRect.left,
					barRect.top,
					barRect.width,
					barRect.height,
					box,
				);
			if (fixedPosRef.current == null) {
				fixedPosRef.current = current;
				bar.classList.remove(
					'absolute',
					'bottom-full',
					'left-1/2',
					'mb-[9px]',
					'-translate-x-1/2',
				);
				bar.classList.add('fixed');
				applyFixedStyle(current);
			}
			return current;
		},
		[applyFixedStyle],
	);

	const onHandlePointerDown = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			if (e.button !== 0) return;
			const box = resolveBoundsEl().getBoundingClientRect();
			const bar = barRef.current;
			const barRect = bar?.getBoundingClientRect();
			if (!bar || !barRect) return;
			e.preventDefault();
			e.currentTarget.setPointerCapture(e.pointerId);
			const startedFromDefault = fixedPosRef.current == null;
			setDragActive(true);
			const current = promoteToFixed(bar, barRect, box);
			const barW = sizeRef.current?.w ?? barRect.width;
			const barH = sizeRef.current?.h ?? barRect.height;
			dragRef.current = {
				pointerId: e.pointerId,
				startX: e.clientX,
				startY: e.clientY,
				originLeft: current.left,
				originTop: current.top,
				barW,
				barH,
				box,
				startedFromDefault,
				moved: false,
			};
		},
		[promoteToFixed],
	);

	const onHandlePointerMove = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== e.pointerId) return;
			const dx = e.clientX - drag.startX;
			const dy = e.clientY - drag.startY;
			const next = clampFixed(
				drag.originLeft + dx,
				drag.originTop + dy,
				drag.barW,
				drag.barH,
				drag.box,
			);
			fixedPosRef.current = next;
			applyFixedStyle(next);
			if (!drag.moved && (Math.abs(dx) > MOVE_EPS || Math.abs(dy) > MOVE_EPS)) {
				drag.moved = true;
				setFixedPos(next);
			}
		},
		[applyFixedStyle],
	);

	const onHandlePointerUp = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== e.pointerId) return;
			dragRef.current = null;
			setDragActive(false);
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				// ignore
			}
			if (!drag.moved && drag.startedFromDefault) {
				resetToDefault();
				return;
			}
			const pos = fixedPosRef.current;
			if (pos) setFixedPos(pos);
		},
		[resetToDefault],
	);

	const onResizePointerDown = useCallback(
		(corner: ResizeCorner) => (e: ReactPointerEvent<HTMLButtonElement>) => {
			if (e.button !== 0) return;
			const box = resolveBoundsEl().getBoundingClientRect();
			const bar = barRef.current;
			const barRect = bar?.getBoundingClientRect();
			if (!bar || !barRect) return;
			e.preventDefault();
			e.stopPropagation();
			e.currentTarget.setPointerCapture(e.pointerId);
			const pos = promoteToFixed(bar, barRect, box);
			// 缩放即视为离位：需要 fixed 态与回位按钮
			setFixedPos(pos);
			const originW = sizeRef.current?.w ?? barRect.width;
			const originH = sizeRef.current?.h ?? barRect.height;
			if (sizeRef.current == null) {
				const seeded = clampSize(originW, originH, box, pos.left, pos.top);
				sizeRef.current = seeded;
				applySizeStyle(seeded);
				setSize(seeded);
			}
			resizeRef.current = {
				pointerId: e.pointerId,
				corner,
				startX: e.clientX,
				startY: e.clientY,
				originW,
				originH,
				left: pos.left,
				top: pos.top,
				bottom: pos.top + originH,
				right: pos.left + originW,
				box,
			};
		},
		[promoteToFixed, applySizeStyle],
	);

	const onResizePointerMove = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			const resize = resizeRef.current;
			if (!resize || resize.pointerId !== e.pointerId) return;
			const dx = e.clientX - resize.startX;
			const dy = e.clientY - resize.startY;
			const prevH = sizeRef.current?.h ?? 0;

			const commit = (next: Size, pos?: Pos) => {
				sizeRef.current = next;
				applySizeStyle(next);
				if (pos) {
					fixedPosRef.current = pos;
					applyFixedStyle(pos);
				}
				if (prevH >= STACK_H !== next.h >= STACK_H) {
					setSize(next);
					if (pos) setFixedPos(pos);
				}
			};

			if (resize.corner === 'ne') {
				const { size: next, top } = clampSizeNe(
					resize.originW + dx,
					resize.originH - dy,
					resize.box,
					resize.left,
					resize.bottom,
				);
				commit(next, { left: resize.left, top });
				return;
			}

			if (resize.corner === 'nw') {
				const {
					size: next,
					left,
					top,
				} = clampSizeNw(
					resize.originW - dx,
					resize.originH - dy,
					resize.box,
					resize.right,
					resize.bottom,
				);
				commit(next, { left, top });
				return;
			}

			if (resize.corner === 'sw') {
				const { size: next, left } = clampSizeSw(
					resize.originW - dx,
					resize.originH + dy,
					resize.box,
					resize.right,
					resize.top,
				);
				commit(next, { left, top: resize.top });
				return;
			}

			// se：左上固定
			const next = clampSize(
				resize.originW + dx,
				resize.originH + dy,
				resize.box,
				resize.left,
				resize.top,
			);
			commit(next);
		},
		[applySizeStyle, applyFixedStyle],
	);

	const onResizePointerUp = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			const resize = resizeRef.current;
			if (!resize || resize.pointerId !== e.pointerId) return;
			resizeRef.current = null;
			const next = sizeRef.current;
			if (next) setSize(next);
			const pos = fixedPosRef.current;
			if (pos) setFixedPos(pos);
			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				// ignore
			}
		},
		[],
	);

	const loading = status === 'loading';
	const playing = status === 'playing';
	const stacked = (size?.h ?? 0) >= STACK_H;
	const sized = size != null;
	const showReset = isDockedAway;

	const controls = (
		<div
			className={cn(
				'flex shrink-0 items-center gap-0.5',
				stacked && 'w-full justify-center px-1.5',
			)}
		>
			<button
				type="button"
				className="text-textcolor/45 hover:text-teal-500 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
				aria-label={t('assistant.selection.dragBar')}
				onPointerDown={onHandlePointerDown}
				onPointerMove={onHandlePointerMove}
				onPointerUp={onHandlePointerUp}
				onPointerCancel={onHandlePointerUp}
			>
				<GripVertical className="size-4" aria-hidden />
			</button>

			{showReset ? (
				<Tooltip content={t('assistant.selection.resetBar')}>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						className="text-textcolor/45 hover:text-teal-500 w-7 h-7 shrink-0"
						aria-label={t('assistant.selection.resetBar')}
						onPointerDown={(e) => e.stopPropagation()}
						onClick={resetToDefault}
					>
						<LocateFixed className="size-4" aria-hidden />
					</Button>
				</Tooltip>
			) : null}

			<Tooltip
				content={
					loading
						? t('ebook.read.listenBook.loading')
						: playing
							? t('ebook.read.listenBook.pause')
							: t('ebook.read.listenBook.resume')
				}
			>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="w-7 h-7 text-teal-500 shrink-0"
					disabled={loading}
					aria-busy={loading}
					aria-label={
						loading
							? t('ebook.read.listenBook.loading')
							: playing
								? t('ebook.read.listenBook.pause')
								: t('ebook.read.listenBook.resume')
					}
					onClick={onTogglePlay}
				>
					{loading ? (
						<Spinner className="size-4 text-teal-500" aria-hidden />
					) : playing ? (
						<SquarePause className="size-4" aria-hidden />
					) : (
						<SquarePlay className="size-4" aria-hidden />
					)}
				</Button>
			</Tooltip>

			<Tooltip content={t('assistant.selection.stopSpeak')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="w-7 h-7 text-teal-500 shrink-0"
					aria-label={t('assistant.selection.stopSpeak')}
					onClick={onStop}
				>
					<SquareStop className="size-4" aria-hidden />
				</Button>
			</Tooltip>

			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="link"
						size="icon-sm"
						disabled={loading}
						className={cn(
							'text-teal-500/80 hover:bg-teal-500/10',
							'h-6 px-1.5! text-base w-fit! shrink-0 rounded-sm font-medium tabular-nums',
							'border-0 shadow-none ring-0 outline-none',
							'focus-visible:border-0 focus-visible:ring-0 focus-visible:shadow-none',
						)}
						aria-label={t('ebook.read.listenBook.speed')}
						onPointerDown={(e) => e.stopPropagation()}
					>
						{formatRate(rate)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="top"
					align="center"
					className="z-50 min-w-18"
				>
					{RATE_PRESETS.map((preset) => (
						<DropdownMenuItem
							key={preset}
							className={cn(
								'tabular-nums flex items-center justify-center',
								preset === rate && 'bg-theme/10 text-teal-500',
							)}
							onSelect={() => onRateChange(preset)}
						>
							{formatRate(preset)}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);

	return (
		<div
			ref={barRef}
			className={cn(
				!sized && width,
				'relative z-99 px-2 flex gap-0.5 rounded-md border border-theme/10 bg-theme-background/5 py-1 shadow-md backdrop-blur-sm',
				isFixedVisual
					? 'fixed'
					: 'absolute bottom-full left-1/2 mb-[9px] -translate-x-1/2',
				stacked ? 'flex-col items-stretch px-0' : 'flex-row items-center px-3',
			)}
			style={{
				...(isFixedVisual && fixedPosRef.current
					? {
							left: fixedPosRef.current.left,
							top: fixedPosRef.current.top,
						}
					: null),
				...(sized
					? {
							width: (sizeRef.current ?? size).w,
							height: (sizeRef.current ?? size).h,
						}
					: null),
			}}
			role="group"
			aria-label={t('assistant.selection.speakBar')}
		>
			{stacked ? (
				<>
					<SpeakPreview text={preview} stacked />
					{controls}
				</>
			) : (
				<>
					{controls}
					<SpeakPreview text={preview} stacked={false} />
				</>
			)}

			{handles.nw ? (
				<button
					type="button"
					className="cursor-crosshair group text-textcolor/40 hover:text-textcolor/60 absolute top-0 left-0 z-10 h-4 w-4 touch-none"
					aria-label={t('assistant.selection.resizeBar')}
					onPointerDown={onResizePointerDown('nw')}
					onPointerMove={onResizePointerMove}
					onPointerUp={onResizePointerUp}
					onPointerCancel={onResizePointerUp}
				>
					<span
						className="border-textcolor/6 group-hover:border-teal-500 absolute top-1 left-1 box-border block h-2 w-2 rounded-tl-[4px] border-t-2 border-l-2"
						aria-hidden
					/>
				</button>
			) : null}

			{handles.ne ? (
				<button
					type="button"
					className="cursor-crosshair group text-textcolor/40 hover:text-textcolor/60 absolute top-0 right-0 z-10 h-4 w-4 touch-none"
					aria-label={t('assistant.selection.resizeBar')}
					onPointerDown={onResizePointerDown('ne')}
					onPointerMove={onResizePointerMove}
					onPointerUp={onResizePointerUp}
					onPointerCancel={onResizePointerUp}
				>
					<span
						className="border-textcolor/6 group-hover:border-teal-500 absolute top-1 right-1 box-border block h-2 w-2 rounded-tr-[4px] border-t-2 border-r-2"
						aria-hidden
					/>
				</button>
			) : null}

			{handles.sw ? (
				<button
					type="button"
					className="cursor-crosshair group text-textcolor/40 hover:text-textcolor/60 absolute bottom-0 left-0 z-10 h-4 w-4 touch-none"
					aria-label={t('assistant.selection.resizeBar')}
					onPointerDown={onResizePointerDown('sw')}
					onPointerMove={onResizePointerMove}
					onPointerUp={onResizePointerUp}
					onPointerCancel={onResizePointerUp}
				>
					<span
						className="border-textcolor/6 group-hover:border-teal-500 absolute bottom-1 left-1 box-border block h-2 w-2 rounded-bl-[4px] border-b-2 border-l-2"
						aria-hidden
					/>
				</button>
			) : null}

			{handles.se ? (
				<button
					type="button"
					className="cursor-crosshair group absolute right-0 bottom-0 z-10 h-4 w-4 touch-none"
					aria-label={t('assistant.selection.resizeBar')}
					onPointerDown={onResizePointerDown('se')}
					onPointerMove={onResizePointerMove}
					onPointerUp={onResizePointerUp}
					onPointerCancel={onResizePointerUp}
				>
					{/* 略小于条的 rounded-md，避免角弧显得偏大 */}
					<span
						className="border-textcolor/6 group-hover:border-teal-500 absolute right-1 bottom-1 box-border block h-2 w-2 rounded-br-[4px] border-r-2 border-b-2"
						aria-hidden
					/>
				</button>
			) : null}
		</div>
	);
}
