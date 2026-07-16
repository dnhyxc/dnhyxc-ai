/**
 * 电子书阅读：EPUB / PDF 共用目录抽屉
 */
import { Drawer } from '@design/Drawer';
import { Button, ScrollArea } from '@ui/index';
import { ChevronDown, ChevronUp, LocateFixed } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EbookTocItem } from '../../types';
import {
	epubReaderChromeListItemActiveClass,
	epubReaderChromeListItemIdleClass,
} from '../../utils/epub/reader/epubReaderSettings';

/** 目录列表滚动：同一按钮循环 底 → 顶 → 当前 */
type TocScrollMode = 'bottom' | 'top' | 'current';

const TOC_SCROLL_NEXT: Record<TocScrollMode, TocScrollMode> = {
	bottom: 'top',
	top: 'current',
	current: 'bottom',
};

export type EbookTocDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: EbookTocItem[];
	/** 当前阅读位置对应的目录项索引；无匹配时为 -1 */
	activeIndex?: number;
	onSelect: (item: EbookTocItem) => void;
	/** EPUB 阅读 chrome 字色（Drawer Portal 内需单独挂载） */
	chromeStyle?: CSSProperties;
};

export function EbookTocDrawer({
	open,
	onOpenChange,
	items,
	activeIndex = -1,
	onSelect,
	chromeStyle,
}: EbookTocDrawerProps) {
	const { t } = useI18n();
	const activeItemRef = useRef<HTMLButtonElement>(null);
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const [scrollMode, setScrollMode] = useState<TocScrollMode>('bottom');

	useEffect(() => {
		if (!open) return;
		setScrollMode('bottom');
	}, [open]);

	useEffect(() => {
		if (!open || activeIndex < 0) return;
		const id = requestAnimationFrame(() => {
			activeItemRef.current?.scrollIntoView({ block: 'nearest' });
		});
		return () => cancelAnimationFrame(id);
	}, [open, activeIndex, items]);

	const scrollLabel =
		scrollMode === 'bottom'
			? t('ebook.read.tocScrollToBottom')
			: scrollMode === 'top'
				? t('ebook.read.tocScrollToTop')
				: t('ebook.read.tocScrollToCurrent');

	const onScrollFabClick = () => {
		const vp = scrollViewportRef.current;
		if (scrollMode === 'bottom') {
			vp?.scrollTo({ top: vp.scrollHeight, behavior: 'smooth' });
		} else if (scrollMode === 'top') {
			vp?.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			activeItemRef.current?.scrollIntoView({
				block: 'center',
				behavior: 'smooth',
			});
		}
		setScrollMode(TOC_SCROLL_NEXT[scrollMode]);
	};

	return (
		<Drawer
			title={t('ebook.read.toc')}
			open={open}
			onOpenChange={onOpenChange}
			bodyClassName="pt-1.5 pb-2"
			contentStyle={chromeStyle}
			onOpenAutoFocus={(e) => {
				// 默认会焦到第一项（常为「版权页」），idle 的 focus 底色像双选中
				if (activeIndex < 0) return;
				e.preventDefault();
				requestAnimationFrame(() => {
					activeItemRef.current?.focus({ preventScroll: true });
					activeItemRef.current?.scrollIntoView({ block: 'nearest' });
				});
			}}
		>
			<div className="relative flex h-full min-h-0 flex-col">
				<ScrollArea
					ref={scrollViewportRef}
					className="box-border flex min-h-0 flex-1 flex-col pr-1.5"
				>
					<div className="flex min-h-0 w-full flex-1 flex-col gap-1 text-sm">
						{items.length === 0 ? (
							<p className="text-textcolor/55 px-2 py-4 text-sm">
								{t('ebook.read.tocEmpty')}
							</p>
						) : (
							items.map((item, index) => {
								const clickable = Boolean(item.href);
								const isActive = index === activeIndex;
								return (
									<button
										key={`${item.href ?? 'nohref'}-${item.label}-${item.depth ?? 0}-${index}`}
										ref={isActive ? activeItemRef : undefined}
										type="button"
										disabled={!clickable}
										aria-current={isActive ? 'location' : undefined}
										className={cn(
											'w-full cursor-pointer rounded-md px-2 py-2 text-left text-sm',
											clickable
												? epubReaderChromeListItemIdleClass
												: 'cursor-default text-textcolor/45',
											isActive && epubReaderChromeListItemActiveClass,
										)}
										style={
											item.depth
												? { paddingLeft: `${item.depth * 12 + 8}px` }
												: undefined
										}
										onClick={() => {
											if (!item.href) return;
											onSelect(item);
											onOpenChange(false);
										}}
									>
										{item.label}
									</button>
								);
							})
						)}
					</div>
				</ScrollArea>
				{items.length > 0 ? (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="absolute right-3.5 bottom-2 z-10 h-8.5 w-8.5 rounded-full border border-theme/10 bg-theme/20 text-textcolor/70 shadow-sm backdrop-blur-[2px] hover:bg-theme/30 hover:text-textcolor/85"
						aria-label={scrollLabel}
						onClick={onScrollFabClick}
					>
						{scrollMode === 'bottom' ? (
							<ChevronDown className="size-4" aria-hidden />
						) : scrollMode === 'top' ? (
							<ChevronUp className="size-4" aria-hidden />
						) : (
							<LocateFixed className="size-4" aria-hidden />
						)}
					</Button>
				) : null}
			</div>
		</Drawer>
	);
}
