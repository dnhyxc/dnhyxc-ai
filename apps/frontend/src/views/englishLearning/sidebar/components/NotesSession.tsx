import { NotebookPen } from 'lucide-react';
import { useNavigate } from 'react-router';
import { usePluginEnabled } from '@/federation';
import { useI18n } from '@/hooks';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarCard } from './EnglishSidebarCard';

/** 首页侧栏：学习笔记（MF 插件入口；下架后不展示） */
export function NotesSession() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const enabled = usePluginEnabled('learningNotes');

	if (!enabled) return null;

	return (
		<EnglishSidebarCard
			className="@container min-w-0"
			icon={NotebookPen}
			iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.notes}
			headerClassName="mb-5.5"
			title={t('route.englishLearning.notes.title')}
			description={t('englishLearning.notes.desc')}
			actions={[
				{
					label: t('englishLearning.notes.nav'),
					onClick: () => navigate('/english-learning/notes'),
					gradientKey: 'notes',
				},
			]}
		/>
	);
}
