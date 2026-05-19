/**
 * 收藏页顶栏：单词 / 语句分类切换（右侧并排）
 */
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type FavoritesKind = 'vocab' | 'classic';

export type FavoritesKindTabsProps = {
	kind: FavoritesKind;
	onSelectKind: (kind: FavoritesKind) => void;
};

export function FavoritesKindTabs({
	kind,
	onSelectKind,
}: FavoritesKindTabsProps) {
	const { t } = useI18n();

	const items: { id: FavoritesKind; label: string }[] = [
		{ id: 'vocab', label: t('englishLearning.favorites.vocab.nav') },
		{ id: 'classic', label: t('englishLearning.favorites.classic.nav') },
	];

	return (
		<div
			className="flex shrink-0 items-center gap-2 rounded-md border box-border border-theme/10 bg-theme/5 p-0.5 mt-0.5"
			role="tablist"
			aria-label={t('englishLearning.favorites.sidebarTitle')}
		>
			{items.map((item) => {
				const active = kind === item.id;
				return (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onSelectKind(item.id)}
						className={cn(
							'w-23.5 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
							active
								? 'bg-theme-background text-textcolor shadow-sm'
								: 'text-textcolor/65 hover:text-textcolor hover:bg-theme/10',
						)}
					>
						{item.label}
					</button>
				);
			})}
		</div>
	);
}
