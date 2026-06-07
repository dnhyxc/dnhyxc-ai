import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import { SegmentationLine } from '../../components/SegmentationLine';
import { practicePanelBodyClass } from '../../practice/components/session/PanelLayout';
import { FieldCells } from '../../practice/components/session/PracticeFieldGrid';
import type { DailyVocabCard } from '../types';

export function buildDailyFeedbackDetailRows(
	card: DailyVocabCard,
	t: (key: string) => string,
	compact: boolean,
): ReactNode[] {
	const body = practicePanelBodyClass(compact);
	const posText = card.pos?.trim();
	const rows: ReactNode[] = [];

	const translationText = card.translationZh?.trim();
	rows.push(
		<FieldCells
			key="correct"
			label={t('englishLearning.practice.correctAnswer')}
		>
			<span
				className={cn(
					'text-base font-semibold leading-snug',
					compact && 'line-clamp-3',
				)}
			>
				{translationText || '\u00A0'}
			</span>
		</FieldCells>,
	);

	rows.push(
		<FieldCells key="word" label={t('englishLearning.daily.hintLabelWord')}>
			<span className="inline-flex flex-wrap items-baseline gap-x-2">
				<span className="text-xl font-semibold leading-snug">{card.word}</span>
				{posText ? (
					<span className="text-textcolor/50 text-sm font-normal leading-snug">
						{posText}
					</span>
				) : null}
			</span>
		</FieldCells>,
	);

	const ipaText = card.ipa?.trim();
	if (ipaText) {
		rows.push(
			<FieldCells key="ipa" label={t('englishLearning.practice.hintLabelIpa')}>
				<span
					className={cn(
						'font-mono text-teal-600/85 dark:text-teal-400/85',
						body,
					)}
				>
					{displayIpaWrapped(ipaText)}
				</span>
			</FieldCells>,
		);
	}

	const segmentationText = card.segmentation?.trim();
	if (segmentationText) {
		rows.push(
			<FieldCells
				key="seg"
				label={t('englishLearning.practice.hintLabelSegmentation')}
			>
				<SegmentationLine segmentation={segmentationText} />
			</FieldCells>,
		);
	}

	const exampleText = card.example?.trim();
	if (exampleText) {
		rows.push(
			<FieldCells
				key="ex"
				label={t('englishLearning.practice.hintLabelExample')}
			>
				<span
					className={cn(
						'text-textcolor/70 italic',
						body,
						compact && 'line-clamp-3',
					)}
				>
					{exampleText}
				</span>
			</FieldCells>,
		);
	}

	return rows;
}
