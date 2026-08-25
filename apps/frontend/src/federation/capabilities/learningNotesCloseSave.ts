/**
 * 学习笔记子窗关闭保存：await 保存成功后再广播 list-changed（窗口 prevent_close 期间可安全 await）。
 */
import {
	flushLearningNotesDomKeepaliveOnClose,
	flushLearningNotesDomSaveOnClose,
} from './learningNotesDomSync';
import {
	getTrackedLearningNotesNoteId,
	saveLearningNoteAwait,
} from './learningNotesHttpSync';
import { tryGetLearningNotesStoreFromGlobal } from './learningNotesStoreSync';
import {
	getLearningNotesWindowId,
	publishLearningNotesSync,
} from './learningNotesSyncBus';

type StoreRuntime = ReturnType<typeof tryGetLearningNotesStoreFromGlobal> & {
	takeEditorSnapshot?: () => {
		title: string;
		html: string;
		text: string;
		dirty: boolean;
	} | null;
	getEditorSnapshot?:
		| (() => {
				title: string;
				html: string;
				text: string;
				dirty: boolean;
		  } | null)
		| null;
	editingId?: string | null;
	boundNoteId?: string | null;
	saveTargetId?: string | null;
	uploadSessionId?: string | null;
	flushNoteOnPageHide?: () => void;
	autoSaveIfDirty?: (opts?: { silent?: boolean }) => Promise<boolean>;
};

function hasNoteBody(html: string, text: string): boolean {
	if (text.trim()) return true;
	const plain = html
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.trim();
	return plain.length > 0;
}

function readEditorSnapshot(store: StoreRuntime | null) {
	if (typeof store?.takeEditorSnapshot === 'function') {
		return store.takeEditorSnapshot();
	}
	const snapFn = store?.getEditorSnapshot;
	if (typeof snapFn === 'function') return snapFn();
	return null;
}

function resolveCloseSaveNoteId(store: StoreRuntime | null): string | null {
	return (
		store?.saveTargetId ??
		store?.editingId ??
		store?.boundNoteId ??
		getTrackedLearningNotesNoteId()
	);
}

function publishPopoutCloseListChanged(): void {
	publishLearningNotesSync({
		type: 'list-changed',
		reason: 'popout-close-save',
		windowId: getLearningNotesWindowId(),
	});
}

/** 关窗保存：await 接口成功后再通知主窗刷新列表 */
export async function saveLearningNotesOnWindowClose(): Promise<void> {
	(document.activeElement as HTMLElement | null)?.blur?.();

	const store = tryGetLearningNotesStoreFromGlobal() as StoreRuntime | null;
	if (store?.preview) return;

	const snap = readEditorSnapshot(store);
	const noteId = resolveCloseSaveNoteId(store);
	const uploadSessionId = store?.uploadSessionId ?? null;

	if (snap?.dirty && typeof store?.autoSaveIfDirty === 'function') {
		const ok = await store.autoSaveIfDirty({ silent: true });
		if (ok) return;
	}

	let saved = false;
	if (snap && hasNoteBody(snap.html, snap.text)) {
		saved = await saveLearningNoteAwait({
			id: noteId,
			title: snap.title,
			html: snap.html,
			uploadSessionId,
		});
	} else {
		saved = await flushLearningNotesDomSaveOnClose(noteId);
	}

	if (!saved && typeof store?.flushNoteOnPageHide === 'function') {
		store.flushNoteOnPageHide();
		saved = Boolean(snap?.dirty);
	}

	if (saved) publishPopoutCloseListChanged();
}

/** @deprecated 关窗请用 async 版；同步 keepalive 仅作兜底 */
export function saveLearningNotesOnWindowCloseSync(): void {
	void saveLearningNotesOnWindowClose().catch(() => {
		const store = tryGetLearningNotesStoreFromGlobal() as StoreRuntime | null;
		const snap = readEditorSnapshot(store);
		const noteId = resolveCloseSaveNoteId(store);
		if (typeof store?.flushNoteOnPageHide === 'function') {
			store.flushNoteOnPageHide();
		} else if (snap && hasNoteBody(snap.html, snap.text)) {
			flushLearningNotesDomKeepaliveOnClose(noteId);
		}
	});
}
