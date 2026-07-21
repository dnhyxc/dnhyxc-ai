import { NotebookPen } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { usePluginEnabled } from '@/plugins';
import { ENGLISH_SIDEBAR_ICON_GRADIENT } from '../sidebarAccents';
import { EnglishSidebarActions } from './EnglishSidebarActions';
import { EnglishSidebarHeader } from './EnglishSidebarHeader';
import { SidebarPanel } from './SidebarPanel';

/** 首页侧栏：学习笔记（MF 插件入口；下架后不展示） */
export function NotesSession() {
	const { t } = useI18n();
	const navigate = useNavigate();
	const enabled = usePluginEnabled('learningNotes');

	if (!enabled) return null;

	return (
		<SidebarPanel className="@container min-w-0">
			<EnglishSidebarHeader
				icon={NotebookPen}
				iconGradient={ENGLISH_SIDEBAR_ICON_GRADIENT.notes}
				className="mb-5.5"
				title={t('route.englishLearning.notes.title')}
				description={t('englishLearning.notes.desc')}
			/>
			<EnglishSidebarActions
				actions={[
					{
						label: t('englishLearning.notes.nav'),
						onClick: () => navigate('/english-learning/notes'),
						gradientKey: 'notes',
					},
				]}
			/>
		</SidebarPanel>
	);
}
