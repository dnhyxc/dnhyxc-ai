/**
 * 软揭示 — 提示字段行（释义 / 音标 / 来源 / 备注）
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { displayIpaWrapped } from '@/utils';
import type { PracticeHintFields } from '../../types';
import { practicePanelBodyClass } from './PanelLayout';

type TFn = (key: string) => string;

type HintFieldRow = {
	label: string;
	value: ReactNode;
};

/**
 * 软揭示 — 提示字段行（释义 / 音标 / 来源 / 备注）
 */
export function buildHintFieldRows(
	hintContent: PracticeHintFields,
	t: TFn,
	compact: boolean,
): HintFieldRow[] {
	const body = practicePanelBodyClass(compact);
	const rows: HintFieldRow[] = [];

	const translation = hintContent.translationZh?.trim();
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

	const ipaText = hintContent.ipa?.trim();
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

	const source = hintContent.source?.trim();
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

	const noteZh = hintContent.noteZh?.trim();
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
