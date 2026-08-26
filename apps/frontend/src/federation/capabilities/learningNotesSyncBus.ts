/** 学习笔记跨窗同步：BroadcastChannel（Web）+ Tauri emit（桌面多 WebView） */

import { onEmit, onListen } from '@/utils/event';
import { isTauriRuntime } from '@/utils/runtime';

export const LEARNING_NOTES_SYNC_CHANNEL = 'dnhyxc-learning-notes-sync-v1';
/** Tauri 全局事件：WKWebView 多窗之间 BroadcastChannel 常不通 */
export const LEARNING_NOTES_SYNC_TAURI_EVENT = 'dnhyxc-learning-notes-sync-v1';
/** 笔记编辑模式 */
export type LearningNotesSyncMode = 'edit' | 'preview' | null;
/** 学习笔记同步处理器 */
export type LearningNotesSyncHandler = (msg: LearningNotesSyncMessage) => void;
/** 窗口 ID 键 */
const WINDOW_ID_KEY = 'dnhyxc_ln_window_id';
/** 广播通道 */
let channel: BroadcastChannel | null = null;
/** 处理器集合 */
const handlers = new Set<LearningNotesSyncHandler>();
/** Tauri 监听是否已启动 */
let tauriListenStarted = false;

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

/** 分发消息到所有处理器 */
function dispatchToHandlers(msg: LearningNotesSyncMessage) {
	for (const h of handlers) {
		try {
			h(msg);
		} catch (e) {
			console.error('[learningNotesSync]', e);
		}
	}
}

/** 获取广播通道 */
function getChannel(): BroadcastChannel | null {
	if (typeof BroadcastChannel === 'undefined') return null;
	if (!channel) {
		channel = new BroadcastChannel(LEARNING_NOTES_SYNC_CHANNEL);
		channel.onmessage = (ev: MessageEvent<LearningNotesSyncMessage>) => {
			const msg = ev.data;
			if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
			dispatchToHandlers(msg);
		};
	}
	return channel;
}

/** 确保 Tauri 监听已启动，桌面端订阅 Tauri 全局事件；Web 端不走 CustomEvent（同页已有本地 dispatch） */
function ensureTauriListen() {
	if (tauriListenStarted || !isTauriRuntime()) return;
	tauriListenStarted = true;
	void onListen<LearningNotesSyncMessage>(
		LEARNING_NOTES_SYNC_TAURI_EVENT,
		(msg) => {
			if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
			dispatchToHandlers(msg);
		},
	);
}

/** 获取学习笔记窗口 ID */
export function getLearningNotesWindowId(): string {
	if (typeof sessionStorage === 'undefined') return 'ssr';
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

/** 发布学习笔记同步消息 */
export function publishLearningNotesSync(msg: LearningNotesSyncMessage): void {
	ensureTauriListen();
	getChannel()?.postMessage(msg);
	// 本窗订阅者同步投递（BC 不回环）；windowId 过滤由消费方处理
	dispatchToHandlers(msg);
	// Tauri 多 WebView：BC 常不通，靠全局 emit
	if (isTauriRuntime()) {
		void onEmit(LEARNING_NOTES_SYNC_TAURI_EVENT, msg);
	}
}

/** 订阅学习笔记同步消息 */
export function subscribeLearningNotesSync(
	handler: LearningNotesSyncHandler,
): () => void {
	ensureTauriListen();
	getChannel();
	handlers.add(handler);
	return () => {
		handlers.delete(handler);
	};
}
