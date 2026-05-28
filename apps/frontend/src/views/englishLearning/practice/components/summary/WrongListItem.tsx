/**
 * 结算页 — 错题列表单项
 */
import { Button } from '@ui/index';
import { Square, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WrongListItemProps } from '../../types';

export function WrongListItem({
	item,
	playing,
	onTogglePlay,
	playLabel,
	stopLabel,
	variant = 'wrong',
}: WrongListItemProps) {
	const isCorrect = variant === 'correct';
	return (
		<div
			className={cn(
				'bg-theme/5 border-theme/10 flex min-w-0 items-start gap-2 rounded-md border border-l-3 py-2 pr-2 pl-2.5',
				isCorrect
					? 'border-l-teal-500/55 dark:border-l-teal-400/60'
					: 'border-l-rose-600/65',
			)}
		>
			<div className="h-full min-w-0 flex flex-col justify-between flex-1 select-text">
				<div className="truncate text-base font-semibold text-textcolor">
					{item.word}
				</div>
				{item.translationZh?.trim() ? (
					<p className="text-textcolor/65 mt-0.5 line-clamp-2 text-sm leading-snug">
						{item.translationZh}
					</p>
				) : null}
			</div>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={onTogglePlay}
				className={cn(
					'mt-0.5 h-7 w-7 shrink-0 rounded-md border p-0 transition-colors',
					playing
						? 'border-teal-500/40 bg-teal-500/15 text-teal-600 dark:text-teal-400'
						: 'border-theme/10 text-textcolor/60 hover:border-theme/20 hover:bg-theme/10 hover:text-teal-600 dark:hover:text-teal-400',
				)}
				aria-label={playing ? stopLabel : playLabel}
			>
				{playing ? (
					<Square className="size-3.5 fill-current" />
				) : (
					<Volume2 className="size-3.5" />
				)}
			</Button>
		</div>
	);
}
