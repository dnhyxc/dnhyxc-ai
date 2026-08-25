/** 学习笔记跨窗同步：BroadcastChannel + 类型（Web / Tauri 多 WebView 同源） */

export const LEARNING_NOTES_SYNC_CHANNEL = 'dnhyxc-learning-notes-sync-v1';

export type LearningNotesSyncMode = 'edit' | 'preview' | null;

export type LearningNotesSyncMessage =
	| {
			type: 'selection';
			noteId: string | null;
			mode: LearningNotesSyncMode;
			windowId: string;
	  }
	| {
			type: 'draft';
			noteId: string;
			html: string;
			text: string;
			title: string;
			revision: number;
			/** 上传会话：跨窗删图时 settle 须打到上传方会话 */
			uploadSessionId?: string | null;
			/** 对端是否仍有未保存变更；false 时应收端清脏标记 */
			dirty?: boolean;
			windowId: string;
			ts: number;
	  }
	| {
			type: 'saved';
			noteId: string;
			html: string;
			title: string;
			updatedAt?: string;
			windowId: string;
	  }
	| {
			type: 'deleted';
			noteId: string;
			windowId: string;
	  }
	| {
			type: 'list-changed';
			reason?: string;
			windowId: string;
	  }
	| {
			type: 'request-state';
			noteId: string;
			windowId: string;
	  }
	| {
			type: 'state-snapshot';
			noteId: string;
			windowId: string;
			draft?: {
				html: string;
				text: string;
				title: string;
				revision: number;
				dirty?: boolean;
				uploadSessionId?: string | null;
			};
			preview?: { html: string; title: string };
	  };

export type LearningNotesSyncHandler = (msg: LearningNotesSyncMessage) => void;

const WINDOW_ID_KEY = 'dnhyxc_ln_window_id';

let channel: BroadcastChannel | null = null;
const handlers = new Set<LearningNotesSyncHandler>();

function getChannel(): BroadcastChannel | null {
	if (typeof BroadcastChannel === 'undefined') return null;
	if (!channel) {
		// BroadcastChannel 同一浏览器中不同页面（标签页/窗口/iframe）之间的通信
		channel = new BroadcastChannel(LEARNING_NOTES_SYNC_CHANNEL);
		channel.onmessage = (ev: MessageEvent<LearningNotesSyncMessage>) => {
			const msg = ev.data;
			if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
			for (const h of handlers) {
				try {
					h(msg);
				} catch (e) {
					console.error('[learningNotesSync]', e);
				}
			}
		};
	}
	return channel;
}

export function getLearningNotesWindowId(): string {
	if (typeof sessionStorage === 'undefined') {
		return 'ssr';
	}
	let id = sessionStorage.getItem(WINDOW_ID_KEY);
	if (!id) {
		id =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: `w-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		sessionStorage.setItem(WINDOW_ID_KEY, id);
	}
	return id;
}

export function publishLearningNotesSync(msg: LearningNotesSyncMessage): void {
	const ch = getChannel();
	ch?.postMessage(msg);
	for (const h of handlers) {
		try {
			h(msg);
		} catch (e) {
			console.error('[learningNotesSync] local', e);
		}
	}
}

export function subscribeLearningNotesSync(
	handler: LearningNotesSyncHandler,
): () => void {
	getChannel();
	handlers.add(handler);
	return () => handlers.delete(handler);
}
