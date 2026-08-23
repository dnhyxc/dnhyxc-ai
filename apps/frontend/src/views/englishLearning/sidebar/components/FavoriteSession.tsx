import { Layers } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarCard } from './EnglishSidebarCard';

/** 首页侧栏：我的收藏 */
export function FavoriteSession() {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<EnglishSidebarCard
			className="@container min-w-0"
			resumeModuleKey="favorites"
			icon={Layers}
			iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.favorites}
			headerClassName="mb-5.5"
			title={t('route.englishLearning.favorites.title')}
			description={t('englishLearning.favorites.desc')}
			actions={[
				{
					label: t('englishLearning.favorites.vocab.nav'),
					onClick: () => navigate('/english-learning/favorites?kind=vocab'),
					gradientKey: 'favorites',
				},
				{
					label: t('englishLearning.favorites.classic.nav'),
					onClick: () => navigate('/english-learning/favorites?kind=classic'),
					gradientKey: 'favorites',
				},
			]}
		/>
	);
}
