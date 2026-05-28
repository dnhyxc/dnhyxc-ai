/**
 * 单词朗读按钮（与单词库列表样式一致）
 */
import { Button } from '@ui/index';
import { Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VocabWordPlayButtonProps } from '../../types';

export function VocabWordPlayButton({
	playing,
	playAriaLabel,
	stopAriaLabel,
	onPlay,
}: VocabWordPlayButtonProps) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onClick={onPlay}
			className={cn(
				'h-7 w-7 shrink-0 rounded-md border p-2 transition-colors',
				playing
					? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
					: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
			)}
			aria-label={playing ? stopAriaLabel : playAriaLabel}
		>
			{playing ? (
				<Square className="size-3.5 fill-current" />
			) : (
				<Volume2 className="size-3.5" />
			)}
		</Button>
	);
}
