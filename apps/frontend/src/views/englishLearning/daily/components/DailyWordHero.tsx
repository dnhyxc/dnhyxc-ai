import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import { SegmentationLine } from '../../components/SegmentationLine';

type DailyWordHeroProps = {
	word: string;
	ipa?: string;
	pos?: string;
	segmentation?: string;
	translationZh?: string;
	example?: string;
	compact?: boolean;
};

export function DailyWordHero({
	word,
	ipa,
	pos,
	segmentation,
	translationZh,
	example,
	compact = false,
}: DailyWordHeroProps) {
	const posText = pos?.trim();
	const ipaText = ipa?.trim();
	const segmentationText = segmentation?.trim();
	const translationText = translationZh?.trim();
	const exampleText = example?.trim();

	const meaningBlock =
		translationText || exampleText ? (
			<div
				className={cn(
					'flex w-full flex-col items-center gap-1.5',
					compact && 'border-theme/10 border-t pt-2.5',
				)}
			>
				{translationText ? (
					<p
						className={cn(
							'text-textcolor font-medium leading-snug',
							compact ? 'text-sm' : 'text-base',
						)}
					>
						{translationText}
					</p>
				) : null}
				{exampleText ? (
					<p
						className={cn(
							'text-textcolor/60 w-full leading-snug italic',
							compact
								? 'line-clamp-2 text-sm'
								: 'max-w-md text-sm leading-relaxed',
						)}
					>
						{exampleText}
					</p>
				) : null}
			</div>
		) : null;

	return (
		<div
			className={cn(
				'flex w-full min-w-0 flex-col items-center text-center',
				compact ? 'gap-2' : 'gap-2.5',
			)}
		>
			<div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
				<span className="text-textcolor wrap-break-word text-xl font-semibold leading-snug">
					{word}
				</span>
				{posText ? (
					<span className="text-textcolor/50 text-sm leading-snug">
						{posText}
					</span>
				) : null}
			</div>
			{ipaText ? (
				<p className="font-mono text-sm leading-snug text-teal-600/85 dark:text-teal-400/85">
					{displayIpaWrapped(ipaText)}
				</p>
			) : null}
			{segmentationText ? (
				<SegmentationLine
					segmentation={segmentationText}
					className="text-textcolor/55 text-sm leading-snug"
				/>
			) : null}
			{meaningBlock}
		</div>
	);
}
