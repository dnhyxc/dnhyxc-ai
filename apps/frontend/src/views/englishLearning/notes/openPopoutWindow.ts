import { readWindowChromeThemeSync } from '@/hooks/theme';
import { onCreateWindow } from '@/utils';
import {
	LEARNING_NOTES_POPOUT_LABEL,
	LEARNING_NOTES_POPOUT_PATH,
} from './labels';

export { LEARNING_NOTES_POPOUT_LABEL, LEARNING_NOTES_POPOUT_PATH };

/** 打开或聚焦学习笔记独立窗口（尺寸略小于当前主窗） */
export async function openLearningNotesPopoutWindow(): Promise<void> {
	await onCreateWindow({
		label: LEARNING_NOTES_POPOUT_LABEL,
		url: LEARNING_NOTES_POPOUT_PATH,
		title: '学习笔记',
		width: 942,
		height: 664,
		minWidth: 720,
		minHeight: 510,
		theme: readWindowChromeThemeSync(),
	});
}
