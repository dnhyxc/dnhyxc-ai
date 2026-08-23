import { ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarCard } from './EnglishSidebarCard';

/** 首页侧栏：错题集 */
export function MistakeBookSession() {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<EnglishSidebarCard
			className="@container min-w-0"
			resumeModuleKey="mistakes"
			icon={ClipboardList}
			iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.mistakes}
			headerClassName="mb-5.5"
			title={t('route.englishLearning.mistakes.title')}
			description={t('englishLearning.mistakes.homeDesc')}
			actions={[
				{
					label: t('englishLearning.mistakes.vocabNav'),
					onClick: () => navigate('/english-learning/mistakes?kind=vocab'),
					gradientKey: 'mistakes',
				},
				{
					label: t('englishLearning.mistakes.classicNav'),
					onClick: () => navigate('/english-learning/mistakes?kind=classic'),
					gradientKey: 'mistakes',
				},
			]}
		/>
	);
}
