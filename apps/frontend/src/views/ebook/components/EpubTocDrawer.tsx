/**
 * 电子书阅读：EPUB 目录抽屉
 */
import { Drawer } from '@design/Drawer';
import { ScrollArea } from '@ui/index';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { EpubToc } from '../types';

export type EpubTocDrawerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	items: EpubToc[];
	onSelect: (href: string) => void;
};

export function EpubTocDrawer({
	open,
	onOpenChange,
	items,
	onSelect,
}: EpubTocDrawerProps) {
	const { t } = useI18n();

	return (
		<Drawer
			title={t('ebook.read.toc')}
			open={open}
			onOpenChange={onOpenChange}
			bodyClassName="pt-1.5 pb-2"
		>
			<div className="flex h-full min-h-0 flex-col">
				<ScrollArea className="box-border flex min-h-0 flex-1 flex-col pr-1.5">
					<div className="flex min-h-0 w-full flex-1 flex-col gap-1 text-sm">
						{items.map((item) => (
							<button
								key={item.href}
								type="button"
								className={cn(
									'text-textcolor w-full rounded-md px-2 py-2 text-left text-sm',
									'transition-colors hover:bg-theme/10',
								)}
								onClick={() => {
									onSelect(item.href);
									onOpenChange(false);
								}}
							>
								{item.label}
							</button>
						))}
					</div>
				</ScrollArea>
			</div>
		</Drawer>
	);
}
