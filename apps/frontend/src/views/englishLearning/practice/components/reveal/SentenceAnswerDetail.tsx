/**
 * 正确答案详情（经典语句）
 */
import { cn } from '@/lib/utils';
import type { SentenceAnswerDetailProps } from '../../types';

export function SentenceAnswerDetail({
	item,
	correctAnswerLabel,
	showDivider = true,
	sentenceRowTrailing,
}: SentenceAnswerDetailProps) {
	const translationZh = item.translationZh?.trim();
	const source = item.source?.trim();
	const noteZh = item.noteZh?.trim();

	return (
		<div
			className={cn(
				'flex w-full flex-col items-center gap-2 text-center',
				showDivider && 'border-theme/10 mt-4 border-t pt-4',
			)}
		>
			<p className="text-textcolor/50 text-sm font-medium">
				{correctAnswerLabel}
			</p>
			<p className="flex flex-wrap items-center justify-center gap-2 text-textcolor text-base font-semibold leading-snug sm:text-lg">
				<span className="max-w-prose text-center">{item.english}</span>
				{sentenceRowTrailing}
			</p>
			{translationZh ? (
				<p className="text-textcolor text-sm font-medium leading-snug">
					{translationZh}
				</p>
			) : null}
			{source ? (
				<p className="text-textcolor/65 text-xs leading-snug">{source}</p>
			) : null}
			{noteZh ? (
				<p className="text-textcolor/65 mx-auto max-w-prose text-left text-sm leading-relaxed italic">
					{noteZh}
				</p>
			) : null}
		</div>
	);
}
