/**
 * 拉取结果页顶栏：单词 / 语句分类切换
 */
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';

export type PackStreamKind = 'vocab' | 'classic';

export type PackStreamKindTabsProps = {
	kind: PackStreamKind;
	onSelectKind: (kind: PackStreamKind) => void;
};

export function PackStreamKindTabs({
	kind,
	onSelectKind,
}: PackStreamKindTabsProps) {
	const { t } = useI18n();

	const items: { id: PackStreamKind; label: string }[] = [
		{ id: 'vocab', label: t('englishLearning.stream.vocab.nav') },
		{ id: 'classic', label: t('englishLearning.stream.classic.nav') },
	];

	return (
		<div
			className="flex shrink-0 items-center gap-1 rounded-md border border-theme/10 bg-theme/5 p-0.5"
			role="tablist"
			aria-label={t('englishLearning.stream.kindTabsAria')}
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
							'cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
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
