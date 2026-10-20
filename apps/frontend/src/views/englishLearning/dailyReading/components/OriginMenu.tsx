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
import { type ReadingOrigin } from '../utils/origin';

export function OriginMenu({
	origin,
	onSelect,
}: {
	origin: ReadingOrigin;
	onSelect: (origin: ReadingOrigin) => void;
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const items: {
		id: ReadingOrigin;
		label: string;
		Icon: typeof Layers;
	}[] = [
		{
			id: 'day',
			label: t('englishLearning.dailyReading.day'),
			Icon: Layers,
		},
		{
			id: 'manual',
			label: t('englishLearning.dailyReading.manual'),
			Icon: Layers2,
		},
	];
	const current = items.find((item) => item.id === origin) ?? items[0]!;
	const TriggerIcon = open ? PanelTopClose : PanelTopOpen;
	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-label={current.label}
					aria-expanded={open}
					className={cn(
						'h-auto gap-1.5 px-0! py-0 text-sm font-medium text-teal-500 shadow-none',
						'has-[>svg]:px-0!',
						'hover:bg-transparent hover:text-teal-400',
						'focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none',
						'data-[state=open]:bg-transparent data-[state=open]:text-teal-400 data-[state=open]:ring-0',
					)}
				>
					<TriggerIcon className="size-4 shrink-0 opacity-90" aria-hidden />
					<span className="max-w-36 truncate">{current.label}</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
				{items.map((item) => {
					const active = origin === item.id;
					const Icon = item.Icon;
					return (
						<DropdownMenuItem
							key={item.id}
							className="gap-2"
							onSelect={() => onSelect(item.id)}
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
