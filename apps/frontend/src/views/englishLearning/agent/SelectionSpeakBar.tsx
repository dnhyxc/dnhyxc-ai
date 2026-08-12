import Tooltip from '@design/Tooltip';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Button, ScrollArea, Spinner } from '@ui/index';
import { GripVertical, Pause, Play, Square } from 'lucide-react';
import {
	type PointerEvent as ReactPointerEvent,
	type RefObject,
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

type Pos = { left: number; top: number };

type Props = {
	/** 拖动边界（Agent 面板） */
	boundsRef: RefObject<HTMLElement | null>;
	status: SelectionSpeakStatus;
	rate: number;
	preview: string;
	onTogglePlay: () => void;
	onStop: () => void;
	onRateChange: (rate: number) => void;
};

function formatRate(rate: number): string {
	return `${rate.toFixed(1)} X`;
}

/** 固定槽位展示完整当前句；水平可滚、隐藏滚动条 */
function SpeakPreview({ text }: { text: string }) {
	const display = text.trim() || '......';

	return (
		<ScrollArea
			key={display}
			scrollbars="horizontal"
			className="text-textcolor/80 ml-2 mr-2 h-8 min-w-0 flex-1 text-sm pb-0.5"
			scrollbarClassName="pointer-events-none h-0 border-0 opacity-0"
			viewportClassName="flex items-center [&>div]:flex-row! [&>div]:items-center! [&>div]:flex-nowrap!"
			onPointerDown={(e) => e.stopPropagation()}
			onWheel={(e) => {
				// 竖向滚轮转成横向，方便在窄槽里浏览长句
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

/**
 * 选区朗读悬浮条。
 * 默认：挂在 Footer 内，用 bottom-full + mb-3 贴在输入框上方居中（与图示间距一致）。
 * 拖动后改为 fixed，并限制在 boundsRef 内。
 * 拖动中直接改 DOM，避免每帧 setState 重渲染整条（含 ScrollArea/菜单）。
 */
export function SelectionSpeakBar({
	boundsRef,
	status,
	rate,
	preview,
	onTogglePlay,
	onStop,
	onRateChange,
}: Props) {
	const { t } = useI18n();
	const barRef = useRef<HTMLDivElement>(null);
	/** null = 未拖过，走 Footer 锚点默认位 */
	const [fixedPos, setFixedPos] = useState<Pos | null>(null);
	const fixedPosRef = useRef<Pos | null>(null);
	fixedPosRef.current = fixedPos;

	const dragRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		originLeft: number;
		originTop: number;
		barW: number;
		barH: number;
		box: DOMRect;
	} | null>(null);

	const applyFixedStyle = useCallback((pos: Pos) => {
		const el = barRef.current;
		if (!el) return;
		el.style.left = `${pos.left}px`;
		el.style.top = `${pos.top}px`;
	}, []);

	const isFixed = fixedPos != null;

	useEffect(() => {
		const boxEl = boundsRef.current;
		if (!boxEl || !isFixed) return;
		const ro = new ResizeObserver(() => {
			const box = boundsRef.current?.getBoundingClientRect();
			const bar = barRef.current?.getBoundingClientRect();
			const prev = fixedPosRef.current;
			if (!box || !bar || !prev) return;
			const next = clampFixed(prev.left, prev.top, bar.width, bar.height, box);
			fixedPosRef.current = next;
			applyFixedStyle(next);
			setFixedPos(next);
		});
		ro.observe(boxEl);
		return () => ro.disconnect();
	}, [boundsRef, isFixed, applyFixedStyle]);

	const onHandlePointerDown = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			if (e.button !== 0) return;
			const box = boundsRef.current?.getBoundingClientRect();
			const bar = barRef.current;
			const barRect = bar?.getBoundingClientRect();
			if (!box || !bar || !barRect) return;
			e.preventDefault();
			e.currentTarget.setPointerCapture(e.pointerId);
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
				// 首次拖：切到 fixed 并钉住起点（一次 setState）
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
				setFixedPos(current);
			}
			dragRef.current = {
				pointerId: e.pointerId,
				startX: e.clientX,
				startY: e.clientY,
				originLeft: current.left,
				originTop: current.top,
				barW: barRect.width,
				barH: barRect.height,
				box,
			};
		},
		[boundsRef, applyFixedStyle],
	);

	const onHandlePointerMove = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== e.pointerId) return;
			const next = clampFixed(
				drag.originLeft + (e.clientX - drag.startX),
				drag.originTop + (e.clientY - drag.startY),
				drag.barW,
				drag.barH,
				drag.box,
			);
			fixedPosRef.current = next;
			applyFixedStyle(next);
		},
		[applyFixedStyle],
	);

	const onHandlePointerUp = useCallback(
		(e: ReactPointerEvent<HTMLButtonElement>) => {
			const drag = dragRef.current;
			if (!drag || drag.pointerId !== e.pointerId) return;
			dragRef.current = null;
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
	const playing = status === 'playing' || status === 'loading';

	return (
		<div
			ref={barRef}
			className={cn(
				'w-[min(100%-1.5rem,22rem)]',
				'z-40 flex items-center gap-1 rounded-md border border-theme/10 bg-theme-background/5 px-1.5 py-1 shadow-md backdrop-blur-sm',
				fixedPos == null
					? 'absolute bottom-full left-1/2 mb-[9px] -translate-x-1/2'
					: 'fixed',
			)}
			style={
				fixedPos
					? {
							// 拖动中以 ref 为准，避免父级因 preview/status 重渲染把位置打回旧 state
							left: (fixedPosRef.current ?? fixedPos).left,
							top: (fixedPosRef.current ?? fixedPos).top,
						}
					: undefined
			}
			role="group"
			aria-label={t('englishLearning.selection.speakBar')}
		>
			<button
				type="button"
				className="text-textcolor/45 hover:text-textcolor/70 flex h-8 w-6 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing"
				aria-label={t('englishLearning.selection.dragBar')}
				onPointerDown={onHandlePointerDown}
				onPointerMove={onHandlePointerMove}
				onPointerUp={onHandlePointerUp}
				onPointerCancel={onHandlePointerUp}
			>
				<GripVertical className="size-4" aria-hidden />
			</button>

			<Tooltip content={t('englishLearning.selection.stopSpeak')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="w-7 h-7 text-teal-500 shrink-0"
					aria-label={t('englishLearning.selection.stopSpeak')}
					onClick={onStop}
				>
					<Square className="size-4 fill-current" aria-hidden />
				</Button>
			</Tooltip>

			<Tooltip
				content={
					playing
						? t('ebook.read.listenBook.pause')
						: t('ebook.read.listenBook.resume')
				}
			>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="w-7 h-7 text-teal-500 shrink-0"
					aria-label={
						playing
							? t('ebook.read.listenBook.pause')
							: t('ebook.read.listenBook.resume')
					}
					onClick={onTogglePlay}
				>
					{loading ? (
						<Spinner className="size-4 text-teal-500" aria-hidden />
					) : playing ? (
						<Pause className="size-4" aria-hidden />
					) : (
						<Play className="size-4" aria-hidden />
					)}
				</Button>
			</Tooltip>

			<DropdownMenu modal={false}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="link"
						size="icon-sm"
						className={cn(
							'text-teal-500/80 hover:bg-teal-500/10',
							'h-6 px-1.5! text-base w-fit! shrink-0 rounded-sm font-medium tabular-nums',
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
			<SpeakPreview text={preview} />
		</div>
	);
}
