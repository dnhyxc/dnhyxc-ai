import { Layers } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarActions } from './EnglishSidebarActions';
import { EnglishSidebarHeader } from './EnglishSidebarHeader';
import { SidebarPanel } from './SidebarPanel';

/** 首页侧栏：我的收藏 */
export function FavoriteSession() {
	const { t } = useI18n();
	const navigate = useNavigate();

	return (
		<SidebarPanel className="@container min-w-0">
			<EnglishSidebarHeader
				icon={Layers}
				iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.favorites}
				className="mb-5.5"
				title={t('route.englishLearning.favorites.title')}
				description={t('englishLearning.favorites.desc')}
			/>
			<EnglishSidebarActions
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
		</SidebarPanel>
	);
}
