import { useEffect, useState } from 'react';
import { PluginHostPage } from '@/federation';
import { shouldRemountLearningNotesOnListChange } from '@/federation/capabilities/learningNotesDomSync';
import {
	createLearningNotesSyncBinding,
	refreshLearningNotesListIfOpen,
	tryGetLearningNotesStoreFromGlobal,
} from '@/federation/capabilities/learningNotesStoreSync';
import {
	getLearningNotesWindowId,
	subscribeLearningNotesSync,
} from '@/federation/capabilities/learningNotesSyncBus';

type Props = {
	className?: string;
};

/**
 * 学习笔记插件宿主页：列表变更时尝试 refreshList；无 store 时安全 remount 拉新列表。
 */
export function LearningNotesPluginHost({ className }: Props) {
	const [remountKey, setRemountKey] = useState(0);

	useEffect(() => {
		return subscribeLearningNotesSync((msg) => {
			if ('windowId' in msg && msg.windowId === getLearningNotesWindowId()) {
				return;
			}
			if (
				msg.type !== 'list-changed' &&
				msg.type !== 'deleted' &&
				msg.type !== 'saved'
			) {
				return;
			}

			const store = tryGetLearningNotesStoreFromGlobal();
			if (store) {
				const binding = createLearningNotesSyncBinding(store);
				if (msg.type === 'deleted') {
					binding.applyRemoteDeleted(msg.noteId);
				} else if (
					msg.type === 'saved' &&
					(store.preview?.id === msg.noteId ||
						(msg.html.trim() && store.editingId === msg.noteId))
				) {
					binding.applyRemoteSaved(msg.noteId, {
						html: msg.html,
						title: msg.title,
					});
				}
				refreshLearningNotesListIfOpen();
				return;
			}

			if (shouldRemountLearningNotesOnListChange()) {
				setRemountKey((k) => k + 1);
			}
		});
	}, []);

	return (
		<PluginHostPage
			key={remountKey}
			pluginId="learningNotes"
			className={className}
		/>
	);
}
