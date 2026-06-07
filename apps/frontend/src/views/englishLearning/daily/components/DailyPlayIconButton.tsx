import { Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DailyPlayIconButtonProps = {
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
};

export function DailyPlayIconButton({
	playing,
	playLabel,
	onPlay,
}: DailyPlayIconButtonProps) {
	return (
		<button
			type="button"
			onClick={onPlay}
			aria-label={playLabel}
			className={cn(
				'cursor-pointer flex shrink-0 items-center justify-center rounded p-1 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-500/40',
				playing
					? 'text-teal-600 dark:text-teal-400'
					: 'text-teal-500 hover:text-teal-600 dark:hover:text-teal-400',
			)}
		>
			{playing ? (
				<Square className="size-4 fill-current" aria-hidden />
			) : (
				<Volume2 className="size-4" aria-hidden />
			)}
		</button>
	);
}
