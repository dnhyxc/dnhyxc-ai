import Tooltip from '@design/Tooltip';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Button, ScrollArea, Spinner } from '@ui/index';
import {
	ChevronLeft,
	ChevronRight,
	ListOrdered,
	LocateFixed,
	Pause,
	Play,
	Square,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { type ChapterListenStatus } from '../../hooks/useEpubChapterListen';
import {
	epubReaderChromeBorderColorClass,
	epubReaderChromeListItemActiveClass,
	epubReaderChromeListItemIdleClass,
	epubReaderChromeMenuContentClass,
} from '../../utils/epub/reader/epubReaderSettings';

function formatListenRate(value: number): string {
	return `${value.toFixed(1)} X`;
}

const RATE_RULER_MIN = 0.5;
const RATE_RULER_MAX = 3;
/** 参考刻度：短刻度 0.1x，相邻长刻度 0.5x（5 格 / 4 根短线） */
const RATE_RULER_STEP = 0.1;
const RATE_RULER_MAJOR_STEP = 0.5;
const RATE_RULER_SPACES = RATE_RULER_MAJOR_STEP / RATE_RULER_STEP;
const RATE_RULER_STEP_COUNT = Math.round(
	(RATE_RULER_MAX - RATE_RULER_MIN) / RATE_RULER_STEP,
);
const RATE_RULER_LABELS = Array.from(
	{ length: RATE_RULER_STEP_COUNT / RATE_RULER_SPACES + 1 },
	(_, i) => Number((RATE_RULER_MIN + i * RATE_RULER_MAJOR_STEP).toFixed(1)),
);
/** 刻度区左右留白，使 0 / max 刻度与指示器均按中心对齐且可贴边选中 */
const RULER_INSET_PX = 6;

type RateRulerTick = { index: number; major: boolean };

function buildRateRulerTicks(stepCount: number): RateRulerTick[] {
	const ticks: RateRulerTick[] = [];
	for (let base = 0; base <= stepCount; base += RATE_RULER_SPACES) {
		ticks.push({ index: base, major: true });
		for (let j = 1; j < RATE_RULER_SPACES; j += 1) {
			const idx = base + j;
			if (idx <= stepCount) ticks.push({ index: idx, major: false });
		}
	}
	return ticks;
}
/** 刻度尺下方快捷倍速（参考 UI 圆形按钮） */
const RATE_PRESETS = [1, 1.5, 2, 2.5, 3] as const;

function clampListenRate(rate: number, max = RATE_RULER_MAX): number {
	return Math.min(max, Math.max(RATE_RULER_MIN, rate));
}

function listenRateToTickIndex(rate: number): number {
	return Math.round((clampListenRate(rate) - RATE_RULER_MIN) / RATE_RULER_STEP);
}

function rulerPositionStyle(index: number): CSSProperties {
	const t =
		Math.min(RATE_RULER_STEP_COUNT, Math.max(0, index)) / RATE_RULER_STEP_COUNT;
	return {
		left: `calc(${RULER_INSET_PX}px + (100% - ${RULER_INSET_PX * 2}px) * ${t})`,
		transform: 'translateX(-50%)',
	};
}

function indexFromTrackClientX(track: HTMLDivElement, clientX: number): number {
	const rect = track.getBoundingClientRect();
	const travel = rect.width - RULER_INSET_PX * 2;
	if (travel <= 0) return 0;
	if (clientX <= rect.left + RULER_INSET_PX) return 0;
	if (clientX >= rect.right - RULER_INSET_PX) return RATE_RULER_STEP_COUNT;
	const ratio = (clientX - rect.left - RULER_INSET_PX) / travel;
	return Math.round(Math.min(1, Math.max(0, ratio)) * RATE_RULER_STEP_COUNT);
}

function snapRateToRuler(rate: number): number {
	const index = listenRateToTickIndex(rate);
	return Number((RATE_RULER_MIN + index * RATE_RULER_STEP).toFixed(1));
}

function rateFromTrackClientX(track: HTMLDivElement, clientX: number): number {
	const index = indexFromTrackClientX(track, clientX);
	return Number((RATE_RULER_MIN + index * RATE_RULER_STEP).toFixed(1));
}

function EpubListenRatePanel({
	rate,
	onRateChange,
}: {
	rate: number;
	onRateChange: (rate: number) => void;
}) {
	const { t } = useI18n();
	const trackRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);
	const indicatorIndex = listenRateToTickIndex(rate);
	const indicatorStyle = rulerPositionStyle(indicatorIndex);

	const setRateFromPointer = useCallback(
		(clientX: number) => {
			const track = trackRef.current;
			if (!track) return;
			onRateChange(rateFromTrackClientX(track, clientX));
		},
		[onRateChange],
	);

	const handleTrackPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.preventDefault();
			e.stopPropagation();
			draggingRef.current = true;
			e.currentTarget.setPointerCapture(e.pointerId);
			setRateFromPointer(e.clientX);
		},
		[setRateFromPointer],
	);

	const handleTrackPointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!draggingRef.current) return;
			setRateFromPointer(e.clientX);
		},
		[setRateFromPointer],
	);

	const handleTrackPointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			draggingRef.current = false;
			if (e.currentTarget.hasPointerCapture(e.pointerId)) {
				e.currentTarget.releasePointerCapture(e.pointerId);
			}
		},
		[],
	);

	const handleTrackKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			let delta = 0;
			if (e.key === 'ArrowRight' || e.key === 'ArrowUp')
				delta = RATE_RULER_STEP;
			else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown')
				delta = -RATE_RULER_STEP;
			if (!delta) return;
			e.preventDefault();
			onRateChange(
				clampListenRate(Number(snapRateToRuler(rate + delta).toFixed(1))),
			);
		},
		[onRateChange, rate],
	);

	return (
		<div className="px-3 pt-2 pb-3" onPointerDown={(e) => e.stopPropagation()}>
			<div className="text-textcolor/45 text-sm font-normal mb-2.5">
				{t('ebook.read.listenBook.speed')}
			</div>
			<div className="bg-theme/5 px-4.5 pt-2 pb-3.5 rounded-md">
				<p className="text-textcolor text-center text-3xl font-semibold tabular-nums">
					{formatListenRate(snapRateToRuler(rate))}
				</p>

				<div className="relative mt-5">
					<div
						ref={trackRef}
						role="slider"
						tabIndex={0}
						aria-label={t('ebook.read.listenBook.speed')}
						aria-valuemin={RATE_RULER_MIN}
						aria-valuemax={RATE_RULER_MAX}
						aria-valuenow={clampListenRate(rate)}
						aria-valuetext={formatListenRate(rate)}
						className="relative cursor-pointer touch-none outline-none focus-visible:ring-teal-500/40 rounded-sm focus-visible:ring-2"
						onPointerDown={handleTrackPointerDown}
						onPointerMove={handleTrackPointerMove}
						onPointerUp={handleTrackPointerUp}
						onPointerCancel={handleTrackPointerUp}
						onKeyDown={handleTrackKeyDown}
					>
						<div className="pointer-events-none relative h-7">
							<div className="absolute inset-x-0 bottom-0 h-5">
								{buildRateRulerTicks(RATE_RULER_STEP_COUNT).map(
									({ index, major }) => (
										<span
											key={index}
											className={cn(
												'absolute bottom-0 w-px bg-textcolor/25',
												major ? 'h-5' : 'h-2.5',
											)}
											style={rulerPositionStyle(index)}
										/>
									),
								)}
							</div>
							<div
								className="absolute bottom-0 z-10 flex flex-col items-center gap-0 leading-none"
								style={indicatorStyle}
								aria-hidden
							>
								<span className="block size-0 shrink-0 border-x-[5px] border-x-transparent border-t-[6px] border-t-teal-500" />
								<span className="block h-5 w-0.5 shrink-0 bg-teal-500 -mt-px" />
							</div>
						</div>

						<div className="relative mt-1 h-4">
							{RATE_RULER_LABELS.map((label) => (
								<span
									key={label}
									className="text-textcolor/45 absolute whitespace-nowrap text-[10px] tabular-nums"
									style={rulerPositionStyle(listenRateToTickIndex(label))}
								>
									{formatListenRate(label)}
								</span>
							))}
						</div>
					</div>
				</div>

				<div className="mt-5 flex items-center justify-between gap-1">
					{RATE_PRESETS.map((preset) => {
						const selected = Math.abs(rate - preset) < 0.001;
						return (
							<button
								key={preset}
								type="button"
								className={cn(
									'cursor-pointer text-textcolor/70 size-9 shrink-0 rounded-full border text-xs tabular-nums transition-colors',
									selected
										? 'border-teal-500 text-textcolor font-medium'
										: 'border-textcolor/15 hover:border-textcolor/30 hover:text-textcolor',
								)}
								aria-label={formatListenRate(preset)}
								aria-pressed={selected}
								onClick={() => onRateChange(preset)}
							>
								{preset.toFixed(1)}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}

function truncateSentenceLabel(text: string, maxLen = 56): string {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) return '…';
	if (normalized.length <= maxLen) return normalized;
	return `${normalized.slice(0, maxLen)}…`;
}

/** 分句行高（含 gap），与 VirtualSentenceMenuList 布局一致 */
const SENTENCE_ROW_STRIDE_PX = 40;
const SENTENCE_LIST_VIEWPORT_MAX_PX = 260;
const SENTENCE_LIST_OVERSCAN = 5;

function scrollSentenceIndexIntoView(
	viewport: HTMLDivElement,
	index: number,
	total: number,
): void {
	if (total <= 0) return;
	const totalHeight = total * SENTENCE_ROW_STRIDE_PX;
	const maxScroll = Math.max(0, totalHeight - viewport.clientHeight);
	const centered =
		index * SENTENCE_ROW_STRIDE_PX -
		(viewport.clientHeight - SENTENCE_ROW_STRIDE_PX) / 2;
	viewport.scrollTop = Math.min(maxScroll, Math.max(0, centered));
}

/** ponytail: 长章数百句，只渲染视口附近行，避免 600+ DropdownMenuItem 卡 scroll */
function VirtualSentenceMenuList({
	labels,
	activeIndex,
	menuOpen,
	onSelect,
}: {
	labels: string[];
	activeIndex: number;
	menuOpen: boolean;
	onSelect: (index: number) => void;
}) {
	const viewportRef = useRef<HTMLDivElement>(null);
	const userScrolledRef = useRef(false);
	const programmaticScrollRef = useRef(false);
	const activeIndexRef = useRef(activeIndex);
	activeIndexRef.current = activeIndex;
	const [scrollTop, setScrollTop] = useState(0);
	const [userScrolled, setUserScrolled] = useState(false);
	const { t } = useI18n();
	const total = labels.length;
	const listHeight = total * SENTENCE_ROW_STRIDE_PX;

	const scrollToIndex = useCallback(
		(index: number, opts?: { force?: boolean }) => {
			if (!opts?.force && userScrolledRef.current) return;
			const viewport = viewportRef.current;
			if (!viewport) return;
			programmaticScrollRef.current = true;
			scrollSentenceIndexIntoView(viewport, index, total);
			setScrollTop(viewport.scrollTop);
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					programmaticScrollRef.current = false;
				});
			});
		},
		[total],
	);

	const scrollToCurrent = useCallback(() => {
		userScrolledRef.current = false;
		setUserScrolled(false);
		scrollToIndex(activeIndexRef.current, { force: true });
	}, [scrollToIndex]);

	// 仅菜单打开时滚到当前句（勿依赖 activeIndex，避免切句时重复触发）
	useEffect(() => {
		if (!menuOpen) {
			userScrolledRef.current = false;
			setUserScrolled(false);
			return;
		}
		if (total <= 0) return;
		userScrolledRef.current = false;
		setUserScrolled(false);
		const index = activeIndexRef.current;
		let cancelled = false;
		let attempts = 0;
		const tryScroll = () => {
			if (cancelled) return;
			scrollToIndex(index, { force: true });
			const viewport = viewportRef.current;
			if (viewport && viewport.clientHeight > 0) return;
			attempts += 1;
			if (attempts < 24) requestAnimationFrame(tryScroll);
		};
		requestAnimationFrame(tryScroll);
		const t1 = window.setTimeout(() => {
			if (!cancelled) scrollToIndex(index, { force: true });
		}, 80);
		const t2 = window.setTimeout(() => {
			if (!cancelled) scrollToIndex(index, { force: true });
		}, 160);
		return () => {
			cancelled = true;
			window.clearTimeout(t1);
			window.clearTimeout(t2);
		};
	}, [menuOpen, total, scrollToIndex]);

	// 听书切句：用户未手动滚列表时才跟随
	useEffect(() => {
		if (!menuOpen || total <= 0 || userScrolledRef.current) return;
		scrollToIndex(activeIndex);
	}, [menuOpen, activeIndex, total, scrollToIndex]);

	const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
		setScrollTop(e.currentTarget.scrollTop);
		if (programmaticScrollRef.current) return;
		userScrolledRef.current = true;
		setUserScrolled(true);
	}, []);

	const first = Math.max(
		0,
		Math.floor(scrollTop / SENTENCE_ROW_STRIDE_PX) - SENTENCE_LIST_OVERSCAN,
	);
	const last = Math.min(
		total,
		Math.ceil(
			(scrollTop + SENTENCE_LIST_VIEWPORT_MAX_PX) / SENTENCE_ROW_STRIDE_PX,
		) + SENTENCE_LIST_OVERSCAN,
	);

	return (
		<div className="-mx-1 w-[calc(100%+0.5rem)]">
			<DropdownMenuLabel className="pt-0 text-textcolor/45 px-3.5 pb-1.5 text-xs font-normal">
				<div className="h-9 flex items-center justify-between gap-2">
					<div className="min-w-0 truncate text-left">
						{t('ebook.read.listenBook.sentenceMenu')} （{activeIndex + 1}/
						{total}）
					</div>
					{userScrolled ? (
						<Tooltip
							content={t('ebook.read.listenBook.scrollToCurrentSentence')}
						>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="text-textcolor/55 size-7 shrink-0 bg-theme/5 hover:bg-theme/15 hover:text-textcolor/70 border border-theme/5 rounded-full"
								aria-label={t('ebook.read.listenBook.scrollToCurrentSentence')}
								onPointerDown={(e) => e.stopPropagation()}
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									scrollToCurrent();
								}}
							>
								<LocateFixed className="size-3.5" aria-hidden />
							</Button>
						</Tooltip>
					) : null}
				</div>
			</DropdownMenuLabel>
			<ScrollArea
				ref={viewportRef}
				className="max-h-65 w-full"
				viewportClassName="max-h-65 overscroll-y-contain px-1 [&>div]:!block [&>div]:!min-h-0"
				scrollbarClassName="right-0"
				onScroll={handleScroll}
			>
				<div className="relative w-full pb-1" style={{ height: listHeight }}>
					{labels.slice(first, last).map((label, offset) => {
						const index = first + offset;
						const selected = index === activeIndex;
						const preview = truncateSentenceLabel(label);
						return (
							<DropdownMenuItem
								key={index}
								data-active-sentence={selected ? 'true' : undefined}
								aria-current={selected ? 'true' : undefined}
								className={cn(
									'absolute right-0 left-0 flex min-w-0 items-center gap-2 rounded-md px-2 py-2 text-xs leading-snug',
									selected
										? epubReaderChromeListItemActiveClass
										: epubReaderChromeListItemIdleClass,
								)}
								style={{
									top: index * SENTENCE_ROW_STRIDE_PX,
									height: SENTENCE_ROW_STRIDE_PX - 4,
								}}
								onSelect={() => onSelect(index)}
							>
								<span
									className={cn(
										'shrink-0 tabular-nums',
										!selected && 'text-textcolor/45',
									)}
								>
									{index + 1}.
								</span>
								<span className="min-w-0 truncate">{preview}</span>
							</DropdownMenuItem>
						);
					})}
				</div>
			</ScrollArea>
		</div>
	);
}

type Props = {
	status: ChapterListenStatus;
	spineIndex: number;
	sentenceIndex: number;
	sentenceCount: number;
	sentenceLabels: string[];
	rate: number;
	onTogglePlay: () => void;
	onStop: () => void;
	onPrevChapter: () => void;
	onNextChapter: () => void;
	canPrevChapter?: boolean;
	canNextChapter?: boolean;
	onGoToSentence: (index: number) => void;
	onRateChange: (rate: number) => void;
	/** 受控：分句下拉是否展开（便于阅读区 pointer 关闭） */
	sentenceMenuOpen?: boolean;
	onSentenceMenuOpenChange?: (open: boolean) => void;
	/** 受控：倍速下拉是否展开（便于阅读区 pointer 关闭） */
	rateMenuOpen?: boolean;
	onRateMenuOpenChange?: (open: boolean) => void;
	/** Portal 下拉菜单需单独挂阅读 chrome 字色变量 */
	menuChromeStyle?: CSSProperties;
};

/** 听书底部播放条 */
export function EpubListenPlayerBar({
	status,
	spineIndex,
	sentenceIndex,
	sentenceCount,
	sentenceLabels,
	rate,
	onTogglePlay,
	onStop,
	onPrevChapter,
	onNextChapter,
	canPrevChapter = false,
	canNextChapter = false,
	onGoToSentence,
	onRateChange,
	sentenceMenuOpen: sentenceMenuOpenProp,
	onSentenceMenuOpenChange,
	rateMenuOpen: rateMenuOpenProp,
	onRateMenuOpenChange,
	menuChromeStyle,
}: Props) {
	const { t } = useI18n();
	const [sentenceOpenUncontrolled, setSentenceOpenUncontrolled] =
		useState(false);
	const [rateOpenUncontrolled, setRateOpenUncontrolled] = useState(false);
	const sentenceOpen = sentenceMenuOpenProp ?? sentenceOpenUncontrolled;
	const rateOpen = rateMenuOpenProp ?? rateOpenUncontrolled;

	const handleRateOpenChange = useCallback(
		(open: boolean) => {
			if (onRateMenuOpenChange) onRateMenuOpenChange(open);
			else setRateOpenUncontrolled(open);
		},
		[onRateMenuOpenChange],
	);

	const handleSentenceOpenChange = useCallback(
		(open: boolean) => {
			if (onSentenceMenuOpenChange) onSentenceMenuOpenChange(open);
			else setSentenceOpenUncontrolled(open);
		},
		[onSentenceMenuOpenChange],
	);

	if (status === 'idle') return null;

	const playing = status === 'playing';
	const loading = status === 'loading';
	const progressLabel =
		sentenceCount > 0
			? t('ebook.read.listenBook.progress', {
					chapter: spineIndex + 1,
					current: sentenceIndex + 1,
					total: sentenceCount,
				})
			: t('ebook.read.listenBook.loading');

	return (
		<div
			className={cn(
				'flex shrink-0 items-center gap-2 overflow-x-hidden border-t px-3 h-12',
				epubReaderChromeBorderColorClass,
				'backdrop-blur-[2px]',
			)}
			role="region"
			aria-label={t('ebook.read.listenBook.barAria')}
		>
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
					className="text-teal-500 shrink-0"
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
						<Pause className="size-4" aria-hidden />
					) : (
						<Play className="size-4" aria-hidden />
					)}
				</Button>
			</Tooltip>

			<Tooltip content={t('ebook.read.listenBook.stop')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-teal-500 shrink-0"
					aria-label={t('ebook.read.listenBook.stop')}
					onClick={onStop}
				>
					<Square className="size-3.5 fill-current" aria-hidden />
				</Button>
			</Tooltip>

			<span className="text-textcolor/70 min-w-0 flex-1 truncate text-xs">
				{progressLabel}
			</span>

			<DropdownMenu
				modal={false}
				open={sentenceOpen}
				onOpenChange={handleSentenceOpenChange}
			>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						disabled={loading || sentenceCount <= 0}
						className="text-textcolor/80 shrink-0"
						aria-label={t('ebook.read.listenBook.sentenceMenu')}
						onPointerDown={(e) => e.stopPropagation()}
					>
						<ListOrdered className="size-4" aria-hidden />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="top"
					align="end"
					className={cn(
						'z-50 w-72 overflow-hidden p-1 pb-4',
						epubReaderChromeMenuContentClass,
					)}
					style={menuChromeStyle}
				>
					{sentenceLabels.length === 0 ? (
						<>
							<DropdownMenuLabel className="text-textcolor/45 px-3 pt-2 pb-3 text-center text-xs font-normal">
								{t('ebook.read.listenBook.sentenceMenu')}
							</DropdownMenuLabel>
							<p className="text-textcolor/45 px-2 py-2 text-xs">
								{t('ebook.read.listenBook.sentenceMenuEmpty')}
							</p>
						</>
					) : (
						<VirtualSentenceMenuList
							labels={sentenceLabels}
							activeIndex={sentenceIndex}
							menuOpen={sentenceOpen}
							onSelect={onGoToSentence}
						/>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Tooltip content={t('ebook.read.listenBook.prevChapter')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					disabled={loading || !canPrevChapter}
					aria-label={t('ebook.read.listenBook.prevChapter')}
					onClick={onPrevChapter}
				>
					<ChevronLeft className="size-4" aria-hidden />
				</Button>
			</Tooltip>

			<Tooltip content={t('ebook.read.listenBook.nextChapter')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					disabled={loading || !canNextChapter}
					aria-label={t('ebook.read.listenBook.nextChapter')}
					onClick={onNextChapter}
				>
					<ChevronRight className="size-4" aria-hidden />
				</Button>
			</Tooltip>

			<DropdownMenu
				modal={false}
				open={rateOpen}
				onOpenChange={handleRateOpenChange}
			>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={loading}
						className={cn(
							'text-textcolor/80 border-theme/5 bg-textcolor/8 hover:bg-textcolor/12',
							'h-6 w-15 shrink-0 gap-0.5 rounded-md border px-2.5 text-xs font-medium tabular-nums',
						)}
						aria-label={t('ebook.read.listenBook.speed')}
						title={t('ebook.read.listenBook.speed')}
						onPointerDown={(e) => e.stopPropagation()}
					>
						{formatListenRate(rate)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					side="top"
					align="end"
					className={cn(
						'z-50 w-80 overflow-hidden p-0',
						epubReaderChromeMenuContentClass,
					)}
					style={menuChromeStyle}
				>
					<EpubListenRatePanel rate={rate} onRateChange={onRateChange} />
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
