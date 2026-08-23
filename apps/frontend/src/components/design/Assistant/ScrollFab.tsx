import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScrollFabProps } from './types';

export function ScrollFab({
	mode,
	onClick,
	toBottomLabel,
	toTopLabel,
	variant = 'default',
}: ScrollFabProps) {
	if (mode === 'hidden') return null;

	return (
		<button
			type="button"
			className={cn(
				'z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-theme/10 bg-theme/5 text-textcolor/65 backdrop-blur-sm hover:bg-theme/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
				variant === 'default' &&
					'absolute right-4.5 bottom-[calc(100%+1.12rem)]',
				variant === 'english' &&
					'absolute right-4.5 bottom-[calc(100%+0.62rem)] h-5 w-8 rounded-sm focus-visible:ring-theme/40',
				variant === 'corner' &&
					'h-7 w-7 absolute bottom-4 right-4 rounded-md border-theme/5 bg-theme/5 backdrop-blur-[2px] hover:bg-theme/15',
			)}
			aria-label={mode === 'toBottom' ? toBottomLabel : toTopLabel}
			onClick={onClick}
		>
			{mode === 'toBottom' ? (
				<ChevronDown aria-hidden />
			) : (
				<ChevronUp aria-hidden />
			)}
		</button>
	);
}
