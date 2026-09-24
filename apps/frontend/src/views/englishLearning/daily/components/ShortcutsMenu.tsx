/**
 * 今日记词 — 顶栏快捷键说明（复用练习 ShortcutsMenu UI）
 */
import { useMemo } from 'react';
import { useI18n } from '@/hooks';
import { PracticeShortcutsMenu } from '../../practice/components/shell';
import type { PracticeShortcutsMenuProps } from '../../practice/types';
import type { DailyMemorizeMode } from '../types';

type DailyShortcutsMenuProps = {
	mode: DailyMemorizeMode;
};

export function ShortcutsMenu({ mode }: DailyShortcutsMenuProps) {
	const { t } = useI18n();
	const isSpell = mode === 'dictation' || mode === 'spelling';

	const sections = useMemo((): NonNullable<
		PracticeShortcutsMenuProps['sections']
	> => {
		const play = t('englishLearning.practice.shortcuts.play');
		const feedbackRows = [
			{ label: play, keys: ['space' as const] },
			{
				label: t('englishLearning.daily.shortcuts.next'),
				keys: ['down' as const],
			},
		];

		if (isSpell) {
			return [
				{
					title: t('englishLearning.daily.shortcuts.sectionQuiz'),
					rows: [
						{ label: play, keys: ['space', 'shiftSpace'] },
						{
							label: t('englishLearning.practice.shortcuts.togglePos'),
							keys: ['ctrlShiftP'],
						},
						{
							label: t('englishLearning.practice.shortcuts.toggleIpa'),
							keys: ['ctrlShiftI'],
						},
					],
				},
				{
					title: t('englishLearning.daily.shortcuts.sectionFeedback'),
					rows: feedbackRows,
				},
			];
		}

		return [
			{
				title: t('englishLearning.daily.shortcuts.sectionStudy'),
				rows: [
					{ label: play, keys: ['space'] },
					{
						label: t('englishLearning.daily.shortcuts.startQuiz'),
						keys: ['enter'],
					},
				],
			},
			{
				title: t('englishLearning.daily.shortcuts.sectionQuiz'),
				rows: [{ label: play, keys: ['space'] }],
			},
			{
				title: t('englishLearning.daily.shortcuts.sectionFeedback'),
				rows: feedbackRows,
			},
		];
	}, [isSpell, t]);

	return (
		<PracticeShortcutsMenu
			sections={sections}
			triggerAria={t('englishLearning.daily.shortcuts.triggerAria')}
		/>
	);
}
