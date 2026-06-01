/**
 * 首次答错（软揭示）— 你的答案 + 提示字段 + 底栏（播放 / 看答案）
 */
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import type { PracticeHintFields } from '../../types';
import { buildHintFieldRows } from './HintFieldRows';
import {
	isPracticePanelCompact,
	PracticeScrollableFieldStack,
} from './PanelLayout';
import {
	FieldCells,
	PRACTICE_PANEL_SHELL,
	PracticeShowAnswerButton,
	PracticeSoftWrongListenFooter,
} from './PracticeFieldGrid';

type SoftWrongStageProps = {
	answerLabel: string;
	wrongInput: string;
	hintContent: PracticeHintFields;
	playing: boolean;
	playLabel: string;
	onPlay: () => void;
	guidance: string;
	showAnswerLabel: string;
	onShowAnswer: () => void;
};

export function SoftWrongStage({
	answerLabel,
	wrongInput,
	hintContent,
	playing,
	playLabel,
	onPlay,
	guidance,
	showAnswerLabel,
	onShowAnswer,
}: SoftWrongStageProps) {
	const { t } = useI18n();

	const draftHintRows = buildHintFieldRows(hintContent, t, false);
	const compact = isPracticePanelCompact(draftHintRows.length);
	const hintRows = compact
		? buildHintFieldRows(hintContent, t, true)
		: draftHintRows;

	return (
		<div className={PRACTICE_PANEL_SHELL}>
			<PracticeScrollableFieldStack>
				<FieldCells
					label={answerLabel}
					valueClassName="text-rose-500 font-semibold"
				>
					<span className={cn(compact && 'line-clamp-3')}>{wrongInput}</span>
				</FieldCells>

				{hintRows.map((row) => (
					<FieldCells key={row.label} label={row.label}>
						{row.value}
					</FieldCells>
				))}
			</PracticeScrollableFieldStack>

			<PracticeSoftWrongListenFooter
				playing={playing}
				playLabel={playLabel}
				onPlay={onPlay}
				guidance={guidance}
				trailing={
					<PracticeShowAnswerButton
						label={showAnswerLabel}
						onClick={onShowAnswer}
					/>
				}
			/>
		</div>
	);
}
