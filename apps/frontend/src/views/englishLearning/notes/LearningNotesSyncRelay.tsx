import { eventBus } from '@dnhyxc-ai/federation-kit';
import { useEffect } from 'react';
import {
	type LearningNotesSyncMessage,
	publishLearningNotesSync,
	subscribeLearningNotesSync,
} from '@/federation/capabilities/learningNotesSyncBus';

const PLUGIN_ID = 'learningNotes';

/** 将 BroadcastChannel 消息桥接到 MF EventBus，供插件 api.event 订阅 */
export function LearningNotesSyncRelay() {
	useEffect(() => {
		return subscribeLearningNotesSync((msg) => {
			if (msg.windowId && 'windowId' in msg) {
				eventBus.emit(PLUGIN_ID, `sync:${msg.type}`, msg);
			}
		});
	}, []);
	return null;
}

export { type LearningNotesSyncMessage, publishLearningNotesSync };
