import { eventBus } from '@dnhyxc-ai/federation-kit';
import { useEffect } from 'react';
import {
	type LearningNotesSyncMessage,
	publishLearningNotesSync,
	subscribeLearningNotesSync,
} from '@/federation';

const PLUGIN_ID = 'learningNotes';

/** 跨窗 sync → MF EventBus 桥接；为何做成组件见 specs/learning-notes-popout-window.md §2.2 */
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
