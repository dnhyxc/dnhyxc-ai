import { CheckCircle2, type LucideIcon, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FavoriteToggleButton } from '../../components/FavoriteToggleButton';
import { isPracticePanelCompact } from '../../practice/components/session/PanelLayout';
import { SessionPromptPanel } from '../../practice/components/session/SessionPromptPanel';
import type { DailyVocabCard } from '../types';
import { buildDailyFeedbackDetailRows } from '../utils/buildDailyFeedbackDetailRows';
import { DailyPlayIconButton } from './DailyPlayIconButton';

export type DailyFeedbackVariant = 'correct' | 'wrong';

export type DailyFeedbackProps = {
	variant: DailyFeedbackVariant;
	feedbackText: string;
	card: DailyVocabCard;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
	t: (key: string) => string;
};

const FEEDBACK_VARIANT: Record<
	DailyFeedbackVariant,
	{
		Icon: LucideIcon;
		panelClassName: string;
		headerClassName: string;
		iconClassName: string;
		textClassName: string;
	}
> = {
	correct: {
		Icon: CheckCircle2,
		panelClassName:
			'border-lime-500/25 bg-linear-to-b from-lime-500/10 to-transparent',
		headerClassName: 'border-lime-500/15 bg-lime-500/8',
		iconClassName: 'text-green-600 dark:text-lime-400',
		textClassName: 'text-green-700 dark:text-lime-400',
	},
	wrong: {
		Icon: XCircle,
		panelClassName:
			'border-rose-500/20 bg-linear-to-b from-rose-500/10 to-transparent',
		headerClassName: 'border-rose-500/10 bg-rose-500/8',
		iconClassName: 'text-rose-500 dark:text-rose-400',
		textClassName: 'text-rose-600 dark:text-rose-400',
	},
};

export function DailyFeedback({
	variant,
	feedbackText,
	card,
	playing,
	playLabel,
	onPlay,
	t,
}: DailyFeedbackProps) {
	const {
		Icon,
		panelClassName,
		headerClassName,
		iconClassName,
		textClassName,
	} = FEEDBACK_VARIANT[variant];
	const draftRows = buildDailyFeedbackDetailRows(card, t, false);
	const compact = isPracticePanelCompact(draftRows.length);
	const detailRows = compact
		? buildDailyFeedbackDetailRows(card, t, true)
		: draftRows;

	return (
		<SessionPromptPanel
			fillHeight
			className={cn(
				'select-text min-h-0 flex-1 justify-stretch gap-0 overflow-hidden p-3 pr-2 shadow-none',
				panelClassName,
			)}
		>
			<div
				className={cn(
					'-ml-3 -mr-2 -mt-3 mb-3 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5',
					headerClassName,
				)}
				role="status"
				aria-live="polite"
			>
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<Icon className={cn('size-5 shrink-0', iconClassName)} aria-hidden />
					<p
						className={cn('text-sm font-semibold leading-snug', textClassName)}
					>
						{feedbackText}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-3">
					<FavoriteToggleButton kind="vocab" item={card} />
					<DailyPlayIconButton
						playing={playing}
						playLabel={playLabel}
						onPlay={onPlay}
					/>
				</div>
			</div>
			<div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-1">
				{detailRows}
			</div>
		</SessionPromptPanel>
	);
}
