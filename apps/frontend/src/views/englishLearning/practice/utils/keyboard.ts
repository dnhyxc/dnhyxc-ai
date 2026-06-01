/** 听写作答页播放：Shift + 空格（输入框内也可触发，不与单独空格冲突） */
export function isPracticeShiftSpacePlayShortcut(e: KeyboardEvent): boolean {
	return e.key === ' ' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
}

/** 听写错题/揭示等：单独空格播放（需调用方排除输入框内按键） */
export function isPracticeSpacePlayShortcut(e: KeyboardEvent): boolean {
	return e.key === ' ' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
}
