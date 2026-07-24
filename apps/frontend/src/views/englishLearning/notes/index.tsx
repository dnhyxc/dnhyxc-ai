/**
 * 英语学习 · 学习笔记（MF 插件宿主页）
 */
import { useI18n } from '@/hooks';
import { PluginHostPage, usePluginEnabled } from '@/plugins';

export default function EnglishLearningNotesPage() {
	const { t } = useI18n();
	const enabled = usePluginEnabled('learningNotes');

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col">
				<div className="min-h-0 flex-1 overflow-auto px-5.5 pb-5.5">
					{enabled ? (
						<PluginHostPage pluginId="learningNotes" />
					) : (
						<p className="text-textcolor/55">{t('plugins.host.delisted')}</p>
					)}
				</div>
			</div>
		</div>
	);
}
