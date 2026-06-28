import Tooltip from '@design/Tooltip';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Button, ScrollArea } from '@ui/index';
import {
	ChevronLeft,
	ChevronRight,
	ListOrdered,
	Pause,
	Play,
	Square,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	CHAPTER_LISTEN_RATES,
	type ChapterListenStatus,
} from '../../hooks/useEpubChapterListen';
import {
	epubReaderChromeBorderColorClass,
	epubReaderChromeListItemActiveClass,
	epubReaderChromeListItemIdleClass,
	epubReaderChromeMenuContentClass,
} from '../../utils/epub/reader/epubReaderSettings';

function formatListenRate(value: number): string {
	return `${value} X`;
}

function truncateSentenceLabel(text: string, maxLen = 56): string {
	const normalized = text.replace(/\s+/g, ' ').trim();
	if (!normalized) return '…';
	if (normalized.length <= maxLen) return normalized;
	return `${normalized.slice(0, maxLen)}…`;
}

function offsetTopWithin(
	container: HTMLElement,
	node: HTMLElement,
): number | null {
	let top = 0;
	let el: HTMLElement | null = node;
	while (el && el !== container) {
		top += el.offsetTop;
		el = el.offsetParent as HTMLElement | null;
		if (el && !container.contains(el)) return null;
	}
	return el === container ? top : null;
}

function scrollTopForCenteredItem(
	viewport: HTMLElement,
	item: HTMLElement,
): number {
	const itemTop = offsetTopWithin(viewport, item);
	if (itemTop != null) {
		const maxScroll = Math.max(
			0,
			viewport.scrollHeight - viewport.clientHeight,
		);
		const centered = itemTop - (viewport.clientHeight - item.offsetHeight) / 2;
		return Math.min(maxScroll, Math.max(0, centered));
	}

	const viewRect = viewport.getBoundingClientRect();
	const itemRect = item.getBoundingClientRect();
	const relativeTop = viewport.scrollTop + (itemRect.top - viewRect.top);
	const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
	const centered =
		relativeTop - (viewport.clientHeight - item.offsetHeight) / 2;
	return Math.min(maxScroll, Math.max(0, centered));
}

function isItemVisibleInViewport(
	viewport: HTMLElement,
	item: HTMLElement,
): boolean {
	const viewRect = viewport.getBoundingClientRect();
	const itemRect = item.getBoundingClientRect();
	const margin = 6;
	return (
		itemRect.top >= viewRect.top - margin &&
		itemRect.bottom <= viewRect.bottom + margin
	);
}

function scrollActiveSentenceIntoView(
	viewport: HTMLDivElement | null,
): boolean {
	if (!viewport || viewport.clientHeight <= 0) return false;
	const item = viewport.querySelector<HTMLElement>(
		'[data-active-sentence="true"]',
	);
	if (!item || item.offsetHeight <= 0) return false;

	viewport.scrollTop = scrollTopForCenteredItem(viewport, item);
	if (isItemVisibleInViewport(viewport, item)) return true;

	item.scrollIntoView({ block: 'center', inline: 'nearest' });
	return isItemVisibleInViewport(viewport, item);
}

/** 菜单 Portal 挂载/动画期间视口可能尚未就绪，短周期重试直到滚到位 */
function scheduleScrollToActiveSentence(
	getViewport: () => HTMLDivElement | null,
	isCancelled: () => boolean,
): void {
	let attempts = 0;
	const tryScroll = () => {
		if (isCancelled()) return;
		if (scrollActiveSentenceIntoView(getViewport())) return;
		attempts += 1;
		if (attempts < 24) requestAnimationFrame(tryScroll);
	};
	requestAnimationFrame(tryScroll);

	// 下拉展开动画结束后再对齐一次，避免首帧 rect 不准
	for (const delay of [80, 160]) {
		window.setTimeout(() => {
			if (!isCancelled()) scrollActiveSentenceIntoView(getViewport());
		}, delay);
	}
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
	onPrevSentence: () => void;
	onNextSentence: () => void;
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
	onPrevSentence,
	onNextSentence,
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
	const sentenceViewportRef = useRef<HTMLDivElement | null>(null);
	const sentenceOpenRef = useRef(false);
	const scrollRetryGenRef = useRef(0);

	const handleRateOpenChange = useCallback(
		(open: boolean) => {
			if (onRateMenuOpenChange) onRateMenuOpenChange(open);
			else setRateOpenUncontrolled(open);
		},
		[onRateMenuOpenChange],
	);

	const queueScrollToActiveSentence = useCallback(() => {
		const gen = ++scrollRetryGenRef.current;
		scheduleScrollToActiveSentence(
			() => sentenceViewportRef.current,
			() => gen !== scrollRetryGenRef.current,
		);
	}, []);

	const handleSentenceOpenChange = useCallback(
		(open: boolean) => {
			sentenceOpenRef.current = open;
			if (onSentenceMenuOpenChange) onSentenceMenuOpenChange(open);
			else setSentenceOpenUncontrolled(open);
			if (open) queueScrollToActiveSentence();
			else scrollRetryGenRef.current += 1;
		},
		[onSentenceMenuOpenChange, queueScrollToActiveSentence],
	);

	const bindSentenceViewport = useCallback(
		(node: HTMLDivElement | null) => {
			sentenceViewportRef.current = node;
			if (node && sentenceOpenRef.current) queueScrollToActiveSentence();
		},
		[queueScrollToActiveSentence],
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
					playing
						? t('ebook.read.listenBook.pause')
						: t('ebook.read.listenBook.resume')
				}
			>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-teal-500 shrink-0"
					disabled={loading}
					aria-label={
						playing
							? t('ebook.read.listenBook.pause')
							: t('ebook.read.listenBook.resume')
					}
					onClick={onTogglePlay}
				>
					{playing ? (
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
					<DropdownMenuLabel className="text-textcolor/45 px-3 pt-2 pb-3 text-center text-xs font-normal">
						{t('ebook.read.listenBook.sentenceMenu')} （{sentenceIndex + 1}/
						{sentenceCount}）
					</DropdownMenuLabel>
					{sentenceLabels.length === 0 ? (
						<p className="text-textcolor/45 px-2 py-2 text-xs">
							{t('ebook.read.listenBook.sentenceMenuEmpty')}
						</p>
					) : (
						<ScrollArea
							ref={bindSentenceViewport}
							className="max-h-65 w-full min-h-0 border-0"
							viewportClassName="max-h-65 box-border pe-2 ps-1"
						>
							<div className="flex flex-col gap-1 pb-1">
								{sentenceLabels.map((label, index) => {
									const selected = index === sentenceIndex;
									const preview = truncateSentenceLabel(label);
									return (
										<DropdownMenuItem
											key={index}
											data-active-sentence={selected ? 'true' : undefined}
											aria-current={selected ? 'true' : undefined}
											className={cn(
												'min-w-0 scroll-my-1 items-start gap-2 rounded-md px-2 py-2 text-xs leading-snug transition-colors',
												selected
													? epubReaderChromeListItemActiveClass
													: epubReaderChromeListItemIdleClass,
											)}
											onSelect={() => onGoToSentence(index)}
										>
											<span
												className={cn(
													'shrink-0 tabular-nums',
													selected ? 'text-textcolor' : 'text-textcolor/45',
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
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			<Tooltip content={t('ebook.read.listenBook.prevSentence')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					disabled={loading || sentenceIndex <= 0}
					aria-label={t('ebook.read.listenBook.prevSentence')}
					onClick={onPrevSentence}
				>
					<ChevronLeft className="size-4" aria-hidden />
				</Button>
			</Tooltip>

			<Tooltip content={t('ebook.read.listenBook.nextSentence')}>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="text-textcolor/80 shrink-0"
					disabled={loading || sentenceIndex >= sentenceCount - 1}
					aria-label={t('ebook.read.listenBook.nextSentence')}
					onClick={onNextSentence}
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
							'text-textcolor/75 border-textcolor/22 bg-textcolor/8 hover:bg-textcolor/12',
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
					className={cn('z-50 min-w-36 p-1', epubReaderChromeMenuContentClass)}
					style={menuChromeStyle}
				>
					<DropdownMenuLabel className="text-textcolor/45 px-4.5 pb-3 pt-2 text-center text-xs font-normal">
						{t('ebook.read.listenBook.speed')}
					</DropdownMenuLabel>
					<div className="grid grid-cols-2 gap-1 px-0.5 pb-0.5">
						{CHAPTER_LISTEN_RATES.map((r) => {
							const selected = r === rate;
							return (
								<DropdownMenuItem
									key={r}
									className={cn(
										'min-w-0 justify-center rounded-md px-2 py-1.5 text-xs tabular-nums transition-colors',
										selected
											? epubReaderChromeListItemActiveClass
											: epubReaderChromeListItemIdleClass,
									)}
									onSelect={() => onRateChange(r)}
								>
									{formatListenRate(r)}
								</DropdownMenuItem>
							);
						})}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
