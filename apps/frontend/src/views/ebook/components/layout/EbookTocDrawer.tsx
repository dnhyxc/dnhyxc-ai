/**
 * 电子书阅读：EPUB / PDF 共用目录抽屉
 */
import { Drawer } from '@design/Drawer';
import { ScrollArea } from '@ui/index';
import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EbookTocItem } from '../../types';

export type EbookTocDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: EbookTocItem[];
	/** 当前阅读位置对应的目录项索引；无匹配时为 -1 */
	activeIndex?: number;
	onSelect: (href: string) => void;
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

	useEffect(() => {
		if (!open || activeIndex < 0) return;
		const id = requestAnimationFrame(() => {
			activeItemRef.current?.scrollIntoView({ block: 'nearest' });
		});
		return () => cancelAnimationFrame(id);
	}, [open, activeIndex, items]);

	return (
		<Drawer
			title={t('ebook.read.toc')}
			open={open}
			onOpenChange={onOpenChange}
			bodyClassName="pt-1.5 pb-2"
			contentStyle={chromeStyle}
		>
			<div className="flex h-full min-h-0 flex-col">
				<ScrollArea className="box-border flex min-h-0 flex-1 flex-col pr-1.5">
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
											'cursor-pointer text-textcolor w-full rounded-md px-2 py-2 text-left text-sm',
											clickable
												? 'transition-colors hover:bg-theme/10'
												: 'text-textcolor/45 cursor-default',
											isActive &&
												'bg-theme/15 text-theme font-medium hover:bg-theme/15',
										)}
										style={
											item.depth
												? { paddingLeft: `${item.depth * 12 + 8}px` }
												: undefined
										}
										onClick={() => {
											if (!item.href) return;
											onSelect(item.href);
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
			</div>
		</Drawer>
	);
}
