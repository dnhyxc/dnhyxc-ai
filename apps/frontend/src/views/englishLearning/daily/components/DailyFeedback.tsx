import { cn } from '@/lib/utils';
import { isPracticePanelCompact } from '../../practice/components/session/PanelLayout';
import { SessionPromptPanel } from '../../practice/components/session/SessionPromptPanel';
import type { DailyVocabCard } from '../types';
import { buildDailyFeedbackDetailRows } from '../utils/buildDailyFeedbackDetailRows';

export type DailyFeedbackVariant = 'correct' | 'wrong';

export type DailyFeedbackProps = {
	variant: DailyFeedbackVariant;
	card: DailyVocabCard;
	t: (key: string) => string;
};

const PANEL_CLASS: Record<DailyFeedbackVariant, string> = {
	correct: 'border-lime-500/25 bg-linear-to-b from-lime-500/10 to-transparent',
	wrong: 'border-rose-500/20 bg-linear-to-b from-rose-500/10 to-transparent',
};

/** 反馈详情卡（对错文案与收藏/播放已上移到 SessionHeader） */
export function DailyFeedback({ variant, card, t }: DailyFeedbackProps) {
	const draftRows = buildDailyFeedbackDetailRows(card, t, false);
	const compact = isPracticePanelCompact(draftRows.length);
	const detailRows = compact
		? buildDailyFeedbackDetailRows(card, t, true)
		: draftRows;

	return (
		<SessionPromptPanel
			fillHeight
			className={cn(
				'select-text min-h-0 flex-1 justify-center gap-0 overflow-hidden p-3 shadow-none',
				PANEL_CLASS[variant],
			)}
		>
			<div className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden px-1">
				{detailRows}
			</div>
		</SessionPromptPanel>
	);
}
