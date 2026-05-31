/**
 * 首次答错（软揭示）— 网格字段 + 底栏听音与看答案
 */
import type { ReactNode } from 'react';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type { PracticeHintFields } from '../../types';
import { countPracticeHintFields } from '../../utils/hint';
import {
	FIELD_GRID,
	FieldCells,
	PRACTICE_PANEL_SHELL,
	PracticeShowAnswerButton,
	PracticeSoftWrongListenFooter,
} from './PracticeFieldGrid';

function buildHintRows(
	hintContent: PracticeHintFields,
	t: ReturnType<typeof useI18n>['t'],
	compact: boolean,
): { label: string; value: ReactNode; valueClassName?: string }[] {
	const translation = hintContent.translationZh?.trim();
	const ipaText = hintContent.ipa?.trim();
	const source = hintContent.source?.trim();
	const noteZh = hintContent.noteZh?.trim();
	const body = cn(
		'leading-snug [font-family:var(--font-family)]',
		compact ? 'text-sm' : 'text-base',
	);
	const rows: { label: string; value: ReactNode; valueClassName?: string }[] =
		[];

	if (translation) {
		rows.push({
			label: t('englishLearning.practice.hintLabelTranslation'),
			value: (
				<span className={cn('font-semibold', body, compact && 'line-clamp-4')}>
					{translation}
				</span>
			),
		});
	}
	if (ipaText) {
		rows.push({
			label: t('englishLearning.practice.hintLabelIpa'),
			value: (
				<span
					className={cn(
						'font-mono text-teal-600/85 dark:text-teal-400/85',
						body,
					)}
				>
					{displayIpaWrapped(ipaText)}
				</span>
			),
		});
	}
	if (source) {
		rows.push({
			label: t('englishLearning.practice.hintLabelSource'),
			value: (
				<span
					className={cn('text-textcolor/75', body, compact && 'line-clamp-3')}
				>
					{source}
				</span>
			),
		});
	}
	if (noteZh) {
		rows.push({
			label: t('englishLearning.practice.hintLabelNote'),
			value: (
				<span
					className={cn(
						'text-textcolor/70 italic',
						body,
						compact && 'line-clamp-3',
					)}
				>
					{noteZh}
				</span>
			),
		});
	}
	return rows;
}

type PracticeSoftWrongStageProps = {
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

function PracticeSoftWrongStage({
	answerLabel,
	wrongInput,
	hintContent,
	playing,
	playLabel,
	onPlay,
	guidance,
	showAnswerLabel,
	onShowAnswer,
}: PracticeSoftWrongStageProps) {
	const { t } = useI18n();
	const hintCount = countPracticeHintFields(hintContent);
	const compact = hintCount >= 3;
	const hintRows = buildHintRows(hintContent, t, compact);
	const totalRows = 1 + hintRows.length;

	return (
		<div className={PRACTICE_PANEL_SHELL}>
			<div className="px-1 flex h-full min-h-0 flex-1 flex-col overflow-hidden pb-5">
				<div
					className={cn(
						FIELD_GRID,
						'h-full min-h-0 flex-1 gap-y-2',
						totalRows <= 2 ? 'content-center' : 'content-between',
					)}
					role="status"
					aria-live="polite"
				>
					<FieldCells
						label={answerLabel}
						valueClassName="text-rose-500 font-semibold"
					>
						<span className={cn(compact && 'line-clamp-3')}>{wrongInput}</span>
					</FieldCells>

					{hintRows.map((row) => (
						<FieldCells
							key={row.label}
							label={row.label}
							valueClassName={row.valueClassName}
						>
							{row.value}
						</FieldCells>
					))}
				</div>
			</div>

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

export const DictationSoftWrongStage = PracticeSoftWrongStage;
export const SpellingSoftWrongStage = PracticeSoftWrongStage;
