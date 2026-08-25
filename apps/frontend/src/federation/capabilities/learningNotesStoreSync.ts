import type { HostBridgeProps } from '@dnhyxc-ai/federation-kit';
import {
	getLearningNotesWindowId,
	type LearningNotesSyncMessage,
	publishLearningNotesSync,
	subscribeLearningNotesSync,
} from './learningNotesSyncBus';

export type LearningNotesSyncStoreBinding = {
	getEditingId(): string | null;
	getPreviewId(): string | null;
	refreshList(): Promise<void>;
	applyRemoteDraft(
		noteId: string,
		draft: {
			html: string;
			text: string;
			title: string;
			revision: number;
			uploadSessionId?: string | null;
			dirty?: boolean;
		},
	): void;
	applyRemoteSaved(
		noteId: string,
		payload: { html: string; title: string },
	): void;
	applyRemoteDeleted(noteId: string): void;
};

export type LearningNotesSyncModule = {
	sync: {
		publishDraft(payload: {
			noteId: string;
			html: string;
			text: string;
			title: string;
			revision: number;
		}): void;
		publishSelection(payload: {
			noteId: string | null;
			mode: 'edit' | 'preview' | null;
		}): void;
	};
	connectStore(binding: LearningNotesSyncStoreBinding): () => void;
};

const GLOBAL_STORE_KEY = '__DNHYXC_LN_STORE__';

type GlobalStoreCarrier = {
	editingId: string | null;
	boundNoteId?: string | null;
	saveTargetId?: string | null;
	preview: { id: string; html?: string; title?: string } | null;
	listOpen?: boolean;
	uploadSessionId?: string | null;
	editorSeed: number;
	editorInitial: unknown;
	refreshList(): Promise<void>;
	refreshListFromSync?(): Promise<void>;
	openNew(): void;
	flushNoteOnPageHide?(): void;
	autoSaveIfDirty?(opts?: { silent?: boolean }): Promise<boolean>;
	getEditorSnapshot?(): {
		title: string;
		html: string;
		text: string;
		dirty: boolean;
	} | null;
	takeEditorSnapshot?(): {
		title: string;
		html: string;
		text: string;
		dirty: boolean;
	} | null;
	applyRemoteDraft?(
		noteId: string,
		draft: {
			html: string;
			title: string;
			uploadSessionId?: string | null;
			dirty?: boolean;
		},
	): void;
	applyRemoteSaved?(
		noteId: string,
		payload: { html: string; title: string },
	): void;
	applyRemoteDeleted?(noteId: string): void;
};

/** 子窗/关页前：keepalive 保存 */
export function flushLearningNotesBeforeWindowClose(): Promise<void> {
	return import('./learningNotesCloseSave').then((m) =>
		m.saveLearningNotesOnWindowClose(),
	);
}

/** 插件侧可一行挂载：window.__DNHYXC_LN_STORE__ = store */
export function tryGetLearningNotesStoreFromGlobal(): GlobalStoreCarrier | null {
	if (typeof window === 'undefined') return null;
	const store = (window as unknown as Record<string, unknown>)[
		GLOBAL_STORE_KEY
	] as GlobalStoreCarrier | undefined;
	if (!store || typeof store.refreshList !== 'function') return null;
	return store;
}

/** 主窗左侧列表已展开时才刷新（跨窗 list-changed 用） */
export function refreshLearningNotesListIfOpen(): void {
	const store = tryGetLearningNotesStoreFromGlobal();
	if (!store?.listOpen) return;
	void store.refreshList();
}

/** 从 MobX store 生成默认 binding（插件 connectStore 时可直接传入） */
export function createLearningNotesSyncBinding(
	store: GlobalStoreCarrier,
): LearningNotesSyncStoreBinding {
	return {
		getEditingId: () => store.editingId,
		getPreviewId: () => store.preview?.id ?? null,
		refreshList: () => {
			if (!store.listOpen) return Promise.resolve();
			return store.refreshList();
		},
		applyRemoteDraft: (noteId, draft) => {
			if (store.applyRemoteDraft) {
				store.applyRemoteDraft(noteId, {
					html: draft.html,
					title: draft.title,
					uploadSessionId: draft.uploadSessionId,
					dirty: draft.dirty,
				});
				return;
			}
			if (store.editingId === noteId && draft.html.trim()) {
				store.editorInitial = draft.html;
				store.editorSeed += 1;
			}
			if (store.preview?.id === noteId) {
				store.preview = {
					...store.preview,
					html: draft.html,
					title: draft.title,
				};
			}
		},
		applyRemoteSaved: (noteId, payload) => {
			if (store.applyRemoteSaved) {
				store.applyRemoteSaved(noteId, payload);
				return;
			}
			if (store.preview?.id === noteId) {
				store.preview = {
					...store.preview,
					title: payload.title || store.preview.title,
					...(payload.html.trim() ? { html: payload.html } : {}),
				};
			}
			// 远端 saved 不重载正在编辑的编辑器，避免空 html 清空内容
		},
		applyRemoteDeleted: (noteId) => {
			if (store.applyRemoteDeleted) {
				store.applyRemoteDeleted(noteId);
				return;
			}
			if (store.preview?.id === noteId) store.preview = null;
			if (store.editingId === noteId) {
				store.editingId = null;
				store.editorSeed += 1;
			}
		},
	};
}

function handleRemoteMessage(
	msg: LearningNotesSyncMessage,
	binding: LearningNotesSyncStoreBinding | null,
	localWindowId: string,
) {
	if ('windowId' in msg && msg.windowId === localWindowId) return;

	switch (msg.type) {
		case 'list-changed':
			void binding?.refreshList();
			break;
		case 'deleted':
			binding?.applyRemoteDeleted(msg.noteId);
			void binding?.refreshList();
			break;
		case 'saved':
			if (
				binding &&
				(binding.getPreviewId() === msg.noteId ||
					(msg.html.trim() && binding.getEditingId() === msg.noteId))
			) {
				binding.applyRemoteSaved(msg.noteId, {
					html: msg.html,
					title: msg.title,
				});
			}
			void binding?.refreshList();
			break;
		case 'draft':
			if (
				binding &&
				(binding.getEditingId() === msg.noteId ||
					binding.getPreviewId() === msg.noteId)
			) {
				binding.applyRemoteDraft(msg.noteId, msg);
			}
			break;
		case 'state-snapshot':
			if (
				!binding ||
				(binding.getEditingId() !== msg.noteId &&
					binding.getPreviewId() !== msg.noteId)
			) {
				break;
			}
			if (msg.draft?.html.trim()) {
				binding.applyRemoteDraft(msg.noteId, {
					html: msg.draft.html,
					text: msg.draft.text,
					title: msg.draft.title,
					revision: msg.draft.revision,
					uploadSessionId: msg.draft.uploadSessionId,
					dirty: msg.draft.dirty,
				});
			} else if (msg.preview?.html.trim()) {
				binding.applyRemoteDraft(msg.noteId, {
					html: msg.preview.html,
					text: '',
					title: msg.preview.title,
					revision: 0,
				});
			}
			break;
		default:
			break;
	}
}

export function attachLearningNotesStoreSync(
	binding: LearningNotesSyncStoreBinding,
): () => void {
	const windowId = getLearningNotesWindowId();
	return subscribeLearningNotesSync((msg) =>
		handleRemoteMessage(msg, binding, windowId),
	);
}

let draftRevision = 0;

/** 编辑器 onChange 时由插件调用（或 connectStore 后通过返回的 publishDraft） */
export function publishLocalLearningNotesDraft(payload: {
	noteId: string;
	html: string;
	text: string;
	title: string;
	uploadSessionId?: string | null;
}) {
	draftRevision += 1;
	publishLearningNotesSync({
		type: 'draft',
		...payload,
		revision: draftRevision,
		windowId: getLearningNotesWindowId(),
		ts: Date.now(),
	});
}

export function installLearningNotesApiSync(
	api: HostBridgeProps['api'],
): () => void {
	const mod = api.modules?.learningNotes as LearningNotesSyncModule | undefined;
	if (!mod?.connectStore) return () => {};

	const disposers: Array<() => void> = [];
	let attached = false;

	const tryAttach = () => {
		if (attached) return;
		const store = tryGetLearningNotesStoreFromGlobal();
		if (!store) return;
		const binding = createLearningNotesSyncBinding(store);
		disposers.push(mod.connectStore(binding));
		attached = true;
	};

	tryAttach();
	const poll = window.setInterval(tryAttach, 300);
	disposers.push(() => window.clearInterval(poll));

	return () => {
		for (const d of disposers) d();
	};
}
