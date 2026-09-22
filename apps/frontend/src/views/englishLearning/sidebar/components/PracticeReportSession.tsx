/**
 * 首页侧栏：练习报告（单词 / 语句）
 */
import { Archive } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarCard } from './EnglishSidebarCard';

export function PracticeReportSession() {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<EnglishSidebarCard
			className="@container min-w-0"
			icon={Archive}
			iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.reports}
			headerClassName="mb-5.5"
			title={t('route.englishLearning.practice.reportsTitle')}
			description={t('englishLearning.practice.reportsHomeDesc')}
			actions={[
				{
					label: t('englishLearning.practice.reportsVocabNav'),
					onClick: () =>
						navigate('/english-learning/practice/reports?kind=vocab'),
					gradientKey: 'reports',
				},
				{
					label: t('englishLearning.practice.reportsClassicNav'),
					onClick: () =>
						navigate('/english-learning/practice/reports?kind=classic'),
					gradientKey: 'reports',
				},
			]}
		/>
	);
}
