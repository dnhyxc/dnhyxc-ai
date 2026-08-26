/**
 * 学习笔记独立窗口（无宿主侧栏，主题与主窗同步）
 */
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import {
	ensurePluginEnabledPrefsLoaded,
	PluginHostPage,
	usePluginEnabled,
} from '@/federation';
import { useHostAppearanceSync, useI18n, useTheme } from '@/hooks';
import { hasValidAuthToken } from '@/router/authPaths';
import { LearningNotesPopoutShell } from './LearningNotesPopoutShell';
import { LearningNotesSyncRelay } from './LearningNotesSyncRelay';
import { useLearningNotesPopoutCloseSave } from './usePopoutCloseSave';

export default function EnglishLearningNotesPopoutPage() {
	const { t } = useI18n();
	useTheme();
	useHostAppearanceSync();
	useLearningNotesPopoutCloseSave();
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

	if (!hasValidAuthToken()) {
		return <Navigate to="/login" replace />;
	}

	return (
		<LearningNotesPopoutShell>
			<LearningNotesSyncRelay />
			<div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-theme-background">
				{prefsReady && !enabled ? (
					<p className="text-textcolor/55 p-4.5">
						{t('plugins.host.delisted')}
					</p>
				) : (
					<PluginHostPage
						pluginId="learningNotes"
						className="h-full min-h-0 p-0"
					/>
				)}
			</div>
		</LearningNotesPopoutShell>
	);
}
