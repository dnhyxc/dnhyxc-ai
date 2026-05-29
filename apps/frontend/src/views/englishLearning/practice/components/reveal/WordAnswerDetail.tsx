/**
 * 正确答案详情（单词、音标、分词、释义、例句）
 */
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import { SegmentationLine } from '../../../components/SegmentationLine';
import type { WordAnswerDetailProps } from '../../types';

export function WordAnswerDetail({
	item,
	correctAnswerLabel,
	showDivider = true,
	wordRowTrailing,
}: WordAnswerDetailProps) {
	const translationZh = item.translationZh?.trim();
	const pos = item.pos?.trim();

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
			<p className="flex flex-wrap items-center justify-center gap-2 text-textcolor text-xl font-semibold leading-snug sm:gap-3">
				<span>{item.word}</span>
				{pos ? (
					<span className="text-textcolor/50 text-sm font-normal">{pos}</span>
				) : null}
				{wordRowTrailing}
			</p>
			{item.ipa?.trim() ? (
				<p className="font-mono text-sm leading-snug text-teal-600/90 dark:text-teal-400/90">
					{displayIpaWrapped(item.ipa)}
				</p>
			) : null}
			{item.segmentation?.trim() ? (
				<div className="flex justify-center">
					<SegmentationLine segmentation={item.segmentation} />
				</div>
			) : null}
			{translationZh ? (
				<p className="text-textcolor text-sm font-medium leading-snug">
					{translationZh}
				</p>
			) : null}
			{item.example?.trim() ? (
				<p className="text-textcolor/65 mx-auto max-w-prose text-left text-sm leading-relaxed italic">
					{item.example}
				</p>
			) : null}
		</div>
	);
}
