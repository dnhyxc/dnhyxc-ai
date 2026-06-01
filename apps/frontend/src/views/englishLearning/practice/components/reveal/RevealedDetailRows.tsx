/**
 * 完整揭示 — 正确答案及可选详情行（词表 / 经典句）
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import { SegmentationLine } from '../../../components/SegmentationLine';
import type { PracticeClassicItem, PracticeItem } from '../../types';
import { practicePanelBodyClass } from '../session/PanelLayout';
import { FieldCells } from '../session/PracticeFieldGrid';

type TFn = (key: string) => string;

/**
 * 完整揭示 — 正确答案及可选详情行（词表）
 */
export function buildVocabRevealedDetailRows(
	item: Extract<PracticeItem, { word: string }>,
	correctAnswerLabel: string,
	t: TFn,
	compact: boolean,
): ReactNode[] {
	const body = practicePanelBodyClass(compact);
	const pos = item.pos?.trim();
	const rows: ReactNode[] = [];

	rows.push(
		<FieldCells key="correct" label={correctAnswerLabel}>
			<span className="inline-flex flex-wrap items-baseline gap-x-2">
				<span
					className={cn(
						'text-lg font-semibold leading-snug sm:text-xl',
						'[font-family:var(--font-family)]',
					)}
				>
					{item.word}
				</span>
				{pos ? (
					<span className="text-textcolor/50 text-sm font-normal leading-snug">
						{pos}
					</span>
				) : null}
			</span>
		</FieldCells>,
	);

	if (item.ipa?.trim()) {
		rows.push(
			<FieldCells key="ipa" label={t('englishLearning.practice.hintLabelIpa')}>
				<span
					className={cn(
						'font-mono text-teal-600/85 dark:text-teal-400/85',
						body,
					)}
				>
					{displayIpaWrapped(item.ipa)}
				</span>
			</FieldCells>,
		);
	}

	if (item.segmentation?.trim()) {
		rows.push(
			<FieldCells
				key="seg"
				label={t('englishLearning.practice.hintLabelSegmentation')}
			>
				<SegmentationLine segmentation={item.segmentation} />
			</FieldCells>,
		);
	}

	if (item.translationZh?.trim()) {
		rows.push(
			<FieldCells
				key="zh"
				label={t('englishLearning.practice.hintLabelTranslation')}
			>
				<span className={cn('font-medium', body, compact && 'line-clamp-3')}>
					{item.translationZh}
				</span>
			</FieldCells>,
		);
	}

	if (item.example?.trim()) {
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
					{item.example}
				</span>
			</FieldCells>,
		);
	}

	return rows;
}

/**
 * 完整揭示 — 正确答案及可选详情行（经典句）
 */
export function buildClassicRevealedDetailRows(
	item: PracticeClassicItem,
	correctAnswerLabel: string,
	t: TFn,
	compact: boolean,
): ReactNode[] {
	const body = practicePanelBodyClass(compact);
	const rows: ReactNode[] = [];

	rows.push(
		<FieldCells key="correct" label={correctAnswerLabel}>
			<span
				className={cn(
					'text-lg font-semibold leading-snug sm:text-xl',
					'[font-family:var(--font-family)]',
					compact && 'line-clamp-4',
				)}
			>
				{item.english}
			</span>
		</FieldCells>,
	);

	if (item.translationZh?.trim()) {
		rows.push(
			<FieldCells
				key="zh"
				label={t('englishLearning.practice.hintLabelTranslation')}
			>
				<span className={cn('font-medium', body, compact && 'line-clamp-3')}>
					{item.translationZh}
				</span>
			</FieldCells>,
		);
	}

	if (item.source?.trim()) {
		rows.push(
			<FieldCells
				key="source"
				label={t('englishLearning.practice.hintLabelSource')}
			>
				<span
					className={cn('text-textcolor/75', body, compact && 'line-clamp-3')}
				>
					{item.source}
				</span>
			</FieldCells>,
		);
	}

	if (item.noteZh?.trim()) {
		rows.push(
			<FieldCells
				key="note"
				label={t('englishLearning.practice.hintLabelNote')}
			>
				<span
					className={cn(
						'text-textcolor/70 italic',
						body,
						compact && 'line-clamp-3',
					)}
				>
					{item.noteZh}
				</span>
			</FieldCells>,
		);
	}

	return rows;
}
