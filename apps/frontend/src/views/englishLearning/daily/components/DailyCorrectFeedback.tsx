import { CheckCircle2 } from 'lucide-react';
import { isPracticePanelCompact } from '../../practice/components/session/PanelLayout';
import { SessionPromptPanel } from '../../practice/components/session/SessionPromptPanel';
import { buildDailyFeedbackDetailRows } from '../utils/buildDailyFeedbackDetailRows';
import { DailyPlayIconButton } from './DailyPlayIconButton';
import type { DailyFeedbackPanelProps } from './DailyWrongFeedback';

export function DailyCorrectFeedback({
	feedbackText,
	card,
	playing,
	playLabel,
	onPlay,
	t,
}: DailyFeedbackPanelProps) {
	const draftRows = buildDailyFeedbackDetailRows(card, t, false);
	const compact = isPracticePanelCompact(draftRows.length);
	const detailRows = compact
		? buildDailyFeedbackDetailRows(card, t, true)
		: draftRows;

	return (
		<SessionPromptPanel
			fillHeight
			className="select-text min-h-0 flex-1 justify-stretch gap-0 overflow-hidden border-lime-500/25 bg-linear-to-b from-lime-500/10 to-transparent p-3 pr-2 shadow-none"
		>
			<div
				className="border-lime-500/15 bg-lime-500/8 -mx-3 -mt-3 mb-3 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5"
				role="status"
				aria-live="polite"
			>
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<CheckCircle2
						className="size-5 shrink-0 text-green-600 dark:text-lime-400"
						aria-hidden
					/>
					<p className="text-sm font-semibold leading-snug text-green-700 dark:text-lime-400">
						{feedbackText}
					</p>
				</div>
				<DailyPlayIconButton
					playing={playing}
					playLabel={playLabel}
					onPlay={onPlay}
				/>
			</div>
			<div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-1">
				{detailRows}
			</div>
		</SessionPromptPanel>
	);
}
