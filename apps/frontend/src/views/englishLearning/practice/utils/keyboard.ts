/** 练习页播放：Shift + 空格（不与单独空格输入冲突） */
export function isPracticePlayShortcut(e: KeyboardEvent): boolean {
	return e.key === ' ' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
}
