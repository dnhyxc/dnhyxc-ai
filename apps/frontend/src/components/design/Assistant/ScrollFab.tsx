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
				'absolute right-4.5 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-theme/5 bg-theme/5 text-textcolor/70 shadow-md backdrop-blur-sm hover:bg-theme/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
				variant === 'default' && 'bottom-[calc(100%+1.12rem)]',
				variant === 'english' &&
					'bottom-[calc(100%+0.62rem)] h-5 w-8 rounded-sm focus-visible:ring-theme/40',
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
