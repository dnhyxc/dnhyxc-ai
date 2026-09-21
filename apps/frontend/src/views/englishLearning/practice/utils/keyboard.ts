/** 听写作答页播放：Shift + 空格（输入框内也可触发，不与单独空格冲突） */
export function isPracticeShiftSpacePlayShortcut(e: KeyboardEvent): boolean {
	return (
		e.code === 'Space' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey
	);
}

/** 听写错题/揭示等：单独空格播放（需调用方排除输入框内按键） */
export function isPracticeSpacePlayShortcut(e: KeyboardEvent): boolean {
	return (
		e.code === 'Space' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey
	);
}

/** 经典词槽：Ctrl+Shift+P 切换词性（不用 Alt，避免 macOS Option 死键写入） */
export function isPracticeTogglePosShortcut(e: KeyboardEvent): boolean {
	return (
		e.code === 'KeyP' && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey
	);
}

/** 经典词槽：Ctrl+Shift+I 切换音标 */
export function isPracticeToggleIpaShortcut(e: KeyboardEvent): boolean {
	return (
		e.code === 'KeyI' && e.ctrlKey && e.shiftKey && !e.metaKey && !e.altKey
	);
}
