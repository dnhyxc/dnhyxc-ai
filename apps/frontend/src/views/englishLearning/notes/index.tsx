/**
 * 英语学习 · 学习笔记（MF 插件宿主页）
 *
 * 偏好未就绪时不要渲染「已下架」；Loading 只交给 PluginHostPage，避免两段动画断裂。
 */

import { useEffect, useState } from 'react';
import {
	ensurePluginEnabledPrefsLoaded,
	PluginHostPage,
	usePluginEnabled,
} from '@/federation';
import { useI18n } from '@/hooks';

export default function EnglishLearningNotesPage() {
	const { t } = useI18n();
	const enabled = usePluginEnabled('learningNotes');
	const [prefsReady, setPrefsReady] = useState(false);

	useEffect(() => {
		let cancelled = false;
		void ensurePluginEnabledPrefsLoaded().finally(() => {
			if (!cancelled) setPrefsReady(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<div className="flex min-h-0 h-full w-full flex-col">
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col">
				<div className="min-h-0 flex-1 overflow-auto px-5.5 pb-5.5">
					{prefsReady && !enabled ? (
						<p className="text-textcolor/55">{t('plugins.host.delisted')}</p>
					) : (
						<PluginHostPage pluginId="learningNotes" className="p-0" />
					)}
				</div>
			</div>
		</div>
	);
}
