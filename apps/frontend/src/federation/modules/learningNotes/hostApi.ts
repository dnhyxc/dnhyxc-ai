/**
 * 学习笔记 Host 模块：窗口身份、跨窗同步总线、关窗前钩子。
 * 协议分发与业务（applyRemote / 刷新）在插件内；Host 只提供通道。
 *
 * 勿顶层 import openPopoutWindow：它会经 @/utils 拉回 federation，
 * 触发 getStorage / routeInjector 的 TDZ（子窗冷启空白）。
 */
import { LEARNING_NOTES_POPOUT_PATH } from '@/views/englishLearning/notes/labels';
import {
	getLearningNotesWindowId,
	type LearningNotesSyncMessage,
	publishLearningNotesSync,
	subscribeLearningNotesSync,
} from './syncBus';

/** 关闭前的钩子函数类型 */
type BeforeCloseFn = () => void | Promise<void>;

/** 进程内单例：buildModules 可能多次建 API，关窗 handler 需能找到插件注册的回调 */
const beforeCloseHandlers = new Set<BeforeCloseFn>();

/** 学习笔记 Host 模块类型 */
export type LearningNotesHostModule = ReturnType<
	typeof createLearningNotesModulesApi
>;

/** 运行学习笔记 Popout 窗口关闭前的钩子 */
export async function runLearningNotesBeforeCloseHandlers(): Promise<void> {
	for (const fn of [...beforeCloseHandlers]) {
		try {
			await fn();
		} catch (e) {
			console.warn('[learningNotes] beforeClose failed', e);
		}
	}
}

/** 判断是否为学习笔记 Popout 窗口 */
function isLearningNotesPopoutPath(): boolean {
	if (typeof window === 'undefined') return false;
	return window.location.pathname === LEARNING_NOTES_POPOUT_PATH;
}

/** 创建学习笔记 Host 模块 API */
export function createLearningNotesModulesApi() {
	const windowId = getLearningNotesWindowId();

	return Object.freeze({
		isPopoutWindow: () => isLearningNotesPopoutPath(),
		getWindowId: () => windowId,
		openPopoutWindow: () =>
			import('@/views/englishLearning/notes/openPopoutWindow').then((m) =>
				m.openLearningNotesPopoutWindow(),
			),
		/** Popout 关窗前由插件注册保存回调；Host 只 await 后 destroy */
		registerBeforeClose: (fn: BeforeCloseFn) => {
			beforeCloseHandlers.add(fn);
			return () => {
				beforeCloseHandlers.delete(fn);
			};
		},
		/** 消费初始笔记 ID */
		consumeInitialNoteId: (): string | null => {
			try {
				const id = sessionStorage.getItem('dnhyxc_ln_popout_note_id');
				if (id) sessionStorage.removeItem('dnhyxc_ln_popout_note_id');
				return id;
			} catch {
				return null;
			}
		},
		/** 学习笔记同步 API */
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
