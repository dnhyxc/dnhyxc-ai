/**
 * 英语学习 · 学习笔记（MF 插件宿主页）
 */
import { useI18n } from '@/hooks';
import { PluginHostPage, usePluginEnabled } from '@/plugins';
import { EnglishLearningPanelHeader } from '../components/EnglishLearningPanelHeader';

export default function EnglishLearningNotesPage() {
	const { t } = useI18n();
	const enabled = usePluginEnabled('learningNotes');

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					<EnglishLearningPanelHeader
						title={t('route.englishLearning.notes.title')}
					/>
					<div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
						{enabled ? (
							<PluginHostPage pluginId="learningNotes" />
						) : (
							<p className="text-textcolor/55 text-sm">
								{t('plugins.host.delisted')}
							</p>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
