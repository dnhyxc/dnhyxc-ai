import { saveLearningNotesOnWindowClose } from '@/federation/capabilities/learningNotesCloseSave';
import { registerHostWindowCloseHandler } from '@/utils/hostWindowClose';
import { isTauriRuntime } from '@/utils/runtime';
import {
	LEARNING_NOTES_POPOUT_LABEL,
	LEARNING_NOTES_POPOUT_PATH,
} from './labels';

let registered = false;

/** Popout chunk 加载时即注册，避免 useEffect 前用户点 ❌ */
function ensurePopoutCloseSaveHandler(): void {
	if (registered || !isTauriRuntime()) return;
	const path = window.location.pathname.replace(/\/+$/, '') || '/';
	if (path !== LEARNING_NOTES_POPOUT_PATH) return;
	registered = true;
	registerHostWindowCloseHandler(LEARNING_NOTES_POPOUT_LABEL, async () => {
		await saveLearningNotesOnWindowClose();
	});
}

ensurePopoutCloseSaveHandler();

/** Popout 页再调一次，防止路由懒加载边界 */
export function useLearningNotesPopoutCloseSave(): void {
	ensurePopoutCloseSaveHandler();
}
