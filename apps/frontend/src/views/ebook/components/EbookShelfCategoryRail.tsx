import { Button } from '@ui/index';
import { observer } from 'mobx-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import ebookStore from '@/store/ebook';
import type { EbookShelfCategoryKey } from '../types';

function isActiveKey(
	active: EbookShelfCategoryKey,
	key: EbookShelfCategoryKey,
): boolean {
	if (active.kind !== key.kind) return false;
	if (active.kind === 'category' && key.kind === 'category') {
		return active.categoryId === key.categoryId;
	}
	return true;
}

/** 书架页内栏：书籍分类 Tab（可横向滚动） */
function EbookShelfCategoryRail() {
	const { t } = useI18n();
	const { activeCategoryKey, categories, totalBookCount, uncategorizedCount } =
		ebookStore;

	const chips: Array<{
		key: EbookShelfCategoryKey;
		label: string;
		count: number | null;
	}> = [
		{
			key: { kind: 'all' },
			label: t('ebook.shelf.category.all'),
			count: totalBookCount,
		},
		...categories.map((c) => ({
			key: { kind: 'category' as const, categoryId: c.id },
			label: c.name,
			count: c.bookCount,
		})),
		{
			key: { kind: 'uncategorized' },
			label: t('ebook.shelf.category.uncategorized'),
			count: uncategorizedCount,
		},
	];

	return (
		<div
			className={cn(
				'flex h-full min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain',
				'[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
			)}
			role="tablist"
			aria-label={t('ebook.shelf.category.all')}
		>
			{chips.map((chip) => {
				const active = isActiveKey(activeCategoryKey, chip.key);
				const tabId =
					chip.key.kind === 'category'
						? `ebook-cat-${chip.key.categoryId}`
						: `ebook-cat-${chip.key.kind}`;
				return (
					<Button
						key={tabId}
						id={tabId}
						type="button"
						role="tab"
						aria-selected={active}
						variant="ghost"
						size="sm"
						className={cn(
							'h-8 shrink-0 gap-1.5 px-2.5 font-medium hover:bg-transparent dark:hover:bg-transparent',
							active
								? 'text-textcolor hover:text-textcolor'
								: 'text-textcolor/60 hover:text-textcolor',
						)}
						onClick={() => ebookStore.setActiveCategoryKey(chip.key)}
					>
						<span className="max-w-28 truncate">{chip.label}</span>
						<span
							className={cn(
								'inline-flex min-w-4.5 items-center justify-center rounded-full px-1.5 py-px text-xs leading-none tabular-nums transition-colors',
								active
									? 'bg-teal-600 font-medium text-white'
									: 'bg-theme/10 text-textcolor/55',
							)}
						>
							{chip.count ?? '–'}
						</span>
					</Button>
				);
			})}
		</div>
	);
}

export default observer(EbookShelfCategoryRail);
