/**
 * 结算明细单项（错/对共用）
 */
import { Button } from '@ui/index';
import { Square, Volume2 } from 'lucide-react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type { PracticeItem } from '../../practice/types';
import {
	getPracticeAnswerText,
	isPracticeVocabItem,
} from '../../practice/utils/item';

export type EntryVariant = 'wrong' | 'correct';

export type EntryProps = {
	item: PracticeItem;
	playing: boolean;
	onTogglePlay: () => void;
	playLabel: string;
	stopLabel: string;
	/** 错题红左边框；正确绿左边框 */
	variant?: EntryVariant;
	/** 用户当次输入（有内容才展示） */
	userInput?: string;
};

export function Entry({
	item,
	playing,
	onTogglePlay,
	playLabel,
	stopLabel,
	variant = 'wrong',
	userInput,
}: EntryProps) {
	const { t } = useI18n();
	const isCorrect = variant === 'correct';
	const pos = isPracticeVocabItem(item) ? item.pos?.trim() : '';
	const ipa = isPracticeVocabItem(item) ? item.ipa?.trim() : '';
	const input = userInput?.trim() ?? '';
	return (
		<div
			className={cn(
				'bg-theme/5 border-theme/10 flex min-w-0 items-start gap-2 rounded-md border border-l-3 py-2 pr-2 pl-2.5',
				isCorrect
					? 'border-l-teal-500/55 dark:border-l-teal-400/60'
					: 'border-l-rose-600/65',
			)}
		>
			<div className="flex h-full min-w-0 flex-1 flex-col justify-between select-text">
				<div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
					<span className="line-clamp-2 text-base font-semibold text-textcolor">
						{getPracticeAnswerText(item)}
					</span>
					{pos ? (
						<span className="text-textcolor/50 shrink-0 text-sm font-normal">
							{pos}
						</span>
					) : null}
				</div>
				{ipa ? (
					<span className="text-textcolor/55 mt-1 min-w-0 truncate font-mono text-xs">
						{displayIpaWrapped(ipa)}
					</span>
				) : null}
				{item.translationZh?.trim() ? (
					<p
						className={cn(
							'text-textcolor/65 line-clamp-2 text-sm leading-snug',
							ipa ? 'mt-1.5' : 'mt-0.5',
						)}
					>
						{item.translationZh}
					</p>
				) : null}
				{input ? (
					<p
						className={cn(
							'mt-1.5 line-clamp-2 text-sm leading-snug',
							isCorrect
								? 'text-teal-500/85 dark:text-teal-400/85'
								: 'text-rose-500/85',
						)}
					>
						{t('englishLearning.practice.yourAnswer', { answer: input })}
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
