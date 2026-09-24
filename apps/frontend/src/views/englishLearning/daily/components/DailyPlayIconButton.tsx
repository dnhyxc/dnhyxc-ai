import { Square, Volume2 } from 'lucide-react';
import Tooltip from '@/components/design/Tooltip';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

type DailyPlayIconButtonProps = {
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
};

/** 与练习 Session 顶栏 STAGE_ICON_BTN 同尺寸，保证间距观感一致 */
const PLAY_ICON_BTN =
	'h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 shadow-none transition-colors focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none';

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
				tabIndex={-1}
				onClick={(e) => {
					onPlay();
					e.currentTarget.blur();
				}}
				aria-label={playLabel}
				aria-pressed={playing}
				className={cn(
					PLAY_ICON_BTN,
					playing ? 'text-teal-500' : 'text-textcolor/55',
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
