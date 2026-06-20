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
				'absolute right-4 z-10 flex h-8.5 w-8.5 cursor-pointer items-center justify-center rounded-full border border-theme/5 bg-theme/5 text-textcolor/70 backdrop-blur-[2px] hover:bg-theme/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme/40',
				variant === 'default' && 'bottom-[calc(100%+1.05rem)]',
				variant === 'english' &&
					'bottom-full mb-3.5 focus-visible:ring-theme/40',
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
