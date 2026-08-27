import { runLearningNotesBeforeCloseHandlers } from '@/federation';
import { registerHostWindowCloseHandler } from '@/utils/hostWindowClose';
import { isTauriRuntime } from '@/utils/runtime';
import {
	LEARNING_NOTES_POPOUT_LABEL,
	LEARNING_NOTES_POPOUT_PATH,
} from './labels';

let registered = false;

/**
 * Popout chunk 加载时即注册关窗桥。
 * 实际保存由插件通过 modules.learningNotes.registerBeforeClose 注册。
 */
function ensurePopoutCloseSaveHandler(): void {
	if (registered || !isTauriRuntime()) return;
	const path = window.location.pathname.replace(/\/+$/, '') || '/';
	if (path !== LEARNING_NOTES_POPOUT_PATH) return;
	registered = true;
	registerHostWindowCloseHandler(LEARNING_NOTES_POPOUT_LABEL, async () => {
		await runLearningNotesBeforeCloseHandlers();
	});
}

ensurePopoutCloseSaveHandler();

/** Popout 页再调一次，防止路由懒加载边界 */
export function useLearningNotesPopoutCloseSave(): void {
	ensurePopoutCloseSaveHandler();
}
