/**
 * 错题集 / 今日复习页顶栏：单词 / 语句下拉切换
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

export type MistakesKind = 'vocab' | 'classic';

export type MistakesKindTabsProps = {
	kind: MistakesKind;
	onSelectKind: (kind: MistakesKind) => void;
	/** 覆盖默认「错题集」文案（今日复习等） */
	vocabLabel?: string;
	classicLabel?: string;
	ariaLabel?: string;
};

export function MistakesKindTabs({
	kind,
	onSelectKind,
	vocabLabel,
	classicLabel,
	ariaLabel,
}: MistakesKindTabsProps) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);

	const items: {
		id: MistakesKind;
		label: string;
		Icon: typeof Layers;
	}[] = [
		{
			id: 'vocab',
			label: vocabLabel ?? t('englishLearning.mistakes.vocabNav'),
			Icon: Layers,
		},
		{
			id: 'classic',
			label: classicLabel ?? t('englishLearning.mistakes.classicNav'),
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
					aria-label={ariaLabel ?? t('route.englishLearning.mistakes.title')}
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
