import { BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarCard } from './EnglishSidebarCard';

/** 首页侧栏：每日阅读。设置在独立页，这里只负责跳转。 */
export function DailyReadingSession() {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<EnglishSidebarCard
			className="@container min-w-0"
			icon={BookOpen}
			iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.dailyReading}
			title={t('englishLearning.dailyReading.title')}
			description={t('englishLearning.dailyReading.desc')}
			actions={[
				{
					label: t('englishLearning.dailyReading.nav'),
					onClick: () => navigate('/english-learning/daily-reading'),
					gradientKey: 'dailyReading',
				},
				{
					label: t('englishLearning.dailyReading.settingsNav'),
					onClick: () => navigate('/english-learning/daily-reading/settings'),
					gradientKey: 'dailyReading',
				},
			]}
		/>
	);
}
