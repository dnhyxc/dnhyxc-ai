import { Square, Volume2 } from 'lucide-react';
import Tooltip from '@/components/design/Tooltip';
import { Button } from '@/components/ui';
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
		<Tooltip side="top" content={playLabel}>
			<Button
				type="button"
				variant="link"
				size="sm"
				onClick={onPlay}
				aria-label={playLabel}
				className={cn(
					'cursor-pointer px-0! flex shrink-0 items-center justify-center rounded outline-none transition-colors focus-visible:ring-0 focus-visible:shadow-none',
					playing
						? 'text-teal-600 dark:text-teal-400'
						: 'text-teal-500 hover:text-teal-600 dark:hover:text-teal-400',
				)}
			>
				{playing ? (
					<Square className="size-4.5 fill-current" aria-hidden />
				) : (
					<Volume2 className="size-4.5" aria-hidden />
				)}
			</Button>
		</Tooltip>
	);
}
