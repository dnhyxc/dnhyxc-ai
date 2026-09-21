/**
 * 收藏页顶栏：单词 / 语句下拉切换
 */
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { Button } from '@ui/index';
import {
	Check,
	Layers,
	Layers2,
	PanelTopClose,
	PanelTopOpen,
} from 'lucide-react';
import { useState } from 'react';
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
	const [open, setOpen] = useState(false);

	const items: {
		id: FavoritesKind;
		label: string;
		Icon: typeof Layers;
	}[] = [
		{
			id: 'vocab',
			label: t('englishLearning.favorites.vocab.nav'),
			Icon: Layers,
		},
		{
			id: 'classic',
			label: t('englishLearning.favorites.classic.nav'),
			Icon: Layers2,
		},
	];

	const current = items.find((item) => item.id === kind) ?? items[0]!;
	const TriggerIcon = open ? PanelTopClose : PanelTopOpen;

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label={t('englishLearning.favorites.sidebarTitle')}
					aria-expanded={open}
					className={cn(
						'h-auto gap-1.5 px-0! py-0 text-sm font-medium text-teal-500 shadow-none',
						'has-[>svg]:px-0!',
						'hover:bg-transparent hover:text-teal-400',
						'data-[state=open]:bg-transparent data-[state=open]:text-teal-400',
					)}
				>
					<TriggerIcon className="size-4 shrink-0 opacity-90" aria-hidden />
					<span className="max-w-28 truncate">{current.label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
				{items.map((item) => {
					const active = kind === item.id;
					const Icon = item.Icon;
					return (
						<DropdownMenuItem
							key={item.id}
							className="gap-2"
							onSelect={() => onSelectKind(item.id)}
						>
							<Icon className="size-4 shrink-0 opacity-90" aria-hidden />
							<span className="min-w-0 flex-1 truncate">{item.label}</span>
							<Check
								className={cn(
									'size-3.5 shrink-0',
									active ? 'opacity-100' : 'opacity-0',
								)}
								aria-hidden
							/>
						</DropdownMenuItem>
					);
				})}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
