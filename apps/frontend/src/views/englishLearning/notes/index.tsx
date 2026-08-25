/**
 * 英语学习 · 学习笔记（MF 插件宿主页）
 *
 * 偏好未就绪时不要渲染「已下架」；Loading 只交给 PluginHostPage，避免两段动画断裂。
 */

import { useEffect, useState } from 'react';
import { ensurePluginEnabledPrefsLoaded, usePluginEnabled } from '@/federation';
import { useI18n } from '@/hooks';
import { LearningNotesPluginHost } from './LearningNotesPluginHost';
import { LearningNotesSyncRelay } from './LearningNotesSyncRelay';

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
		<div className="flex h-full min-h-0 w-full flex-col">
			<LearningNotesSyncRelay />
			<div className="box-border flex h-full min-h-0 w-full min-w-0 flex-col p-5.5 pt-0">
				<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
					{prefsReady && !enabled ? (
						<p className="text-textcolor/55 p-4.5">
							{t('plugins.host.delisted')}
						</p>
					) : (
						<LearningNotesPluginHost className="h-full min-h-0 p-0" />
					)}
				</div>
			</div>
		</div>
	);
}
