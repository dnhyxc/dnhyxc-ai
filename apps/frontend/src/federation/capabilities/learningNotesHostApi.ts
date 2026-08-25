import { isLearningNotesPopoutPath } from './learningNotesPopout';
import {
	attachLearningNotesStoreSync,
	createLearningNotesSyncBinding,
	type LearningNotesSyncStoreBinding,
	tryGetLearningNotesStoreFromGlobal,
} from './learningNotesStoreSync';
import {
	getLearningNotesWindowId,
	type LearningNotesSyncMessage,
	publishLearningNotesSync,
	subscribeLearningNotesSync,
} from './learningNotesSyncBus';

export { isLearningNotesPopoutPath };

function readEditorSnapshot(
	store: NonNullable<ReturnType<typeof tryGetLearningNotesStoreFromGlobal>>,
) {
	return store.takeEditorSnapshot?.() ?? store.getEditorSnapshot?.() ?? null;
}

/** 本窗正在看 noteId 时，把未保存草稿/预览推给对端 */
function publishLocalStateSnapshot(noteId: string, windowId: string) {
	const store = tryGetLearningNotesStoreFromGlobal();
	if (!store) return;
	const binding = createLearningNotesSyncBinding(store);
	if (binding.getEditingId() !== noteId && binding.getPreviewId() !== noteId) {
		return;
	}

	const snap =
		binding.getEditingId() === noteId ? readEditorSnapshot(store) : null;
	const draft =
		snap && (snap.html.trim() || snap.dirty)
			? {
					html: snap.html,
					text: snap.text,
					title: snap.title,
					revision: Date.now(),
					dirty: snap.dirty,
					uploadSessionId: store.uploadSessionId ?? null,
				}
			: undefined;

	publishLearningNotesSync({
		type: 'state-snapshot',
		noteId,
		windowId,
		draft,
		preview:
			binding.getPreviewId() === noteId
				? {
						html: store.preview?.html ?? '',
						title: store.preview?.title ?? '',
					}
				: undefined,
	});
}

export function createLearningNotesModulesApi() {
	const windowId = getLearningNotesWindowId();
	let storeDispose: (() => void) | null = null;

	const connectStore = (binding: LearningNotesSyncStoreBinding) => {
		storeDispose?.();
		storeDispose = attachLearningNotesStoreSync(binding);
		return () => {
			storeDispose?.();
			storeDispose = null;
		};
	};

	subscribeLearningNotesSync((msg) => {
		if (msg.windowId === windowId) return;
		if (msg.type === 'request-state') {
			publishLocalStateSnapshot(msg.noteId, windowId);
			return;
		}
		// 对端点开同一篇：仅当本窗有未保存编辑时主动推，避免用干净副本盖掉对端草稿
		if (msg.type === 'selection' && msg.noteId) {
			const store = tryGetLearningNotesStoreFromGlobal();
			if (!store) return;
			const binding = createLearningNotesSyncBinding(store);
			if (binding.getEditingId() !== msg.noteId) return;
			const snap = readEditorSnapshot(store);
			if (snap?.dirty) publishLocalStateSnapshot(msg.noteId, windowId);
		}
	});

	return Object.freeze({
		isPopoutWindow: () => isLearningNotesPopoutPath(),
		getWindowId: () => windowId,
		connectStore,
		consumeInitialNoteId: (): string | null => {
			try {
				const id = sessionStorage.getItem('dnhyxc_ln_popout_note_id');
				if (id) sessionStorage.removeItem('dnhyxc_ln_popout_note_id');
				return id;
			} catch {
				return null;
			}
		},
		sync: Object.freeze({
			publishSelection: (payload: {
				noteId: string | null;
				mode: 'edit' | 'preview' | null;
			}) => {
				publishLearningNotesSync({
					type: 'selection',
					noteId: payload.noteId,
					mode: payload.mode,
					windowId,
				});
			},
			publishDraft: (payload: {
				noteId: string;
				html: string;
				text: string;
				title: string;
				revision: number;
				uploadSessionId?: string | null;
				dirty?: boolean;
			}) => {
				publishLearningNotesSync({
					type: 'draft',
					...payload,
					windowId,
					ts: Date.now(),
				});
			},
			publishSaved: (payload: {
				noteId: string;
				html: string;
				title: string;
				updatedAt?: string;
			}) => {
				publishLearningNotesSync({
					type: 'saved',
					...payload,
					windowId,
				});
			},
			publishDeleted: (noteId: string) => {
				publishLearningNotesSync({ type: 'deleted', noteId, windowId });
			},
			publishListChanged: (reason?: string) => {
				publishLearningNotesSync({ type: 'list-changed', reason, windowId });
			},
			requestState: (noteId: string) => {
				publishLearningNotesSync({
					type: 'request-state',
					noteId,
					windowId,
				});
			},
			publishStateSnapshot: (payload: {
				noteId: string;
				draft?: {
					html: string;
					text: string;
					title: string;
					revision: number;
					dirty?: boolean;
					uploadSessionId?: string | null;
				};
				preview?: { html: string; title: string };
			}) => {
				publishLearningNotesSync({
					type: 'state-snapshot',
					...payload,
					windowId,
				});
			},
			subscribe: (handler: (msg: LearningNotesSyncMessage) => void) =>
				subscribeLearningNotesSync(handler),
		}),
	});
}

export type LearningNotesHostModule = ReturnType<
	typeof createLearningNotesModulesApi
>;
