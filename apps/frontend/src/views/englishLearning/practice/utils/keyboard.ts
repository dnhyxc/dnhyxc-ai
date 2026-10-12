/**
 * IME 用 Enter 上屏时：compositionend 之后仍会冒出一个 isComposing=false 的 Enter。
 * 词槽在 compositionend 里已可能判对并卸掉 input，全局 capture 快捷键会误把该 Enter 当成「下一题」。
 * 与 chat/useEntry 相同：compositionend 后延一拍清标志，吞掉这记确认键。
 */
let imeConfirmGuard = false;

export function markPracticeImeCompositionEnd(): void {
	imeConfirmGuard = true;
	setTimeout(() => {
		imeConfirmGuard = false;
	}, 0);
}

/** 组字中，或 IME 确认键尚未释放的一拍 */
export function isPracticeImeKeyboardEvent(e: KeyboardEvent): boolean {
	return e.isComposing || e.keyCode === 229 || imeConfirmGuard;
}

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
