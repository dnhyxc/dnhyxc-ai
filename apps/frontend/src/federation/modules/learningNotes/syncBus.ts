/** 学习笔记跨窗同步（基于通用 pluginSyncBus） */

import { createHostPluginSyncBus } from '../../sync/hostSyncBus';

export const LEARNING_NOTES_SYNC_CHANNEL = 'dnhyxc-learning-notes-sync-v1';
/** Tauri 全局事件：WKWebView 多窗之间 BroadcastChannel 常不通 */
export const LEARNING_NOTES_SYNC_TAURI_EVENT = 'dnhyxc-learning-notes-sync-v1';
/** 笔记编辑模式 */
export type LearningNotesSyncMode = 'edit' | 'preview' | null;
/** 学习笔记同步处理器 */
export type LearningNotesSyncHandler = (msg: LearningNotesSyncMessage) => void;

const WINDOW_ID_KEY = 'dnhyxc_ln_window_id';

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
			uploadSessionId?: string | null;
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

const bus = createHostPluginSyncBus<LearningNotesSyncMessage>({
	channel: LEARNING_NOTES_SYNC_CHANNEL,
	windowIdKey: WINDOW_ID_KEY,
	tauriEvent: LEARNING_NOTES_SYNC_TAURI_EVENT,
	logTag: 'learningNotesSync',
});

/** 获取学习笔记窗口 ID */
export function getLearningNotesWindowId(): string {
	return bus.getWindowId();
}

/** 发布学习笔记同步消息 */
export function publishLearningNotesSync(msg: LearningNotesSyncMessage): void {
	bus.publish(msg);
}

/** 订阅学习笔记同步消息 */
export function subscribeLearningNotesSync(
	handler: LearningNotesSyncHandler,
): () => void {
	return bus.subscribe(handler);
}
