import { Square, SquarePause, SquarePlay, Volume2 } from 'lucide-react';
import Tooltip from '@/components/design/Tooltip';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

type DailyPlayIconButtonProps = {
	playing: boolean;
	/** pause：与播放条一致用 SquarePlay/SquarePause；默认 stop（方块=停止） */
	mode?: 'stop' | 'pause';
	paused?: boolean;
	playLabel: string;
	onPlay: () => void;
};

/** 与练习 Session 顶栏 STAGE_ICON_BTN 同尺寸，保证间距观感一致 */
const PLAY_ICON_BTN =
	'h-8 w-8 shrink-0 cursor-pointer rounded-md border-0 p-0 shadow-none transition-colors focus-visible:border-transparent focus-visible:ring-0 focus-visible:shadow-none';

export function DailyPlayIconButton({
	playing,
	mode = 'stop',
	paused = false,
	playLabel,
	onPlay,
}: DailyPlayIconButtonProps) {
	const active = mode === 'pause' ? playing && !paused : playing;
	// pause 模式图标对齐听书/划词播放条（SquarePlay / SquarePause）
	const icon =
		mode === 'pause' ? (
			active ? (
				<SquarePause className="size-4" aria-hidden />
			) : (
				<SquarePlay className="size-4" aria-hidden />
			)
		) : playing ? (
			<Square className="size-4.5 fill-current" aria-hidden />
		) : (
			<Volume2 className="size-4.5" aria-hidden />
		);
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
				aria-pressed={active}
				className={cn(PLAY_ICON_BTN, 'text-teal-500 hover:text-teal-400')}
			>
				{icon}
			</Button>
		</Tooltip>
	);
}
