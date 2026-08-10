/**
 * 样式捕获窗口上下文（嵌套 begin/attach 用栈）。
 */
export type CaptureCtx = {
	pluginId: string;
	/** realm / mfStyleOwner 键：同一 Remote 多插件共享 */
	realm: string;
	entryOrigin: string;
};

/** 嵌套 begin/attach 用栈，避免并行加载时 active 互相覆盖 */
export const captureStack: CaptureCtx[] = [];

export function activeCtx(): CaptureCtx | null {
	return captureStack[captureStack.length - 1] ?? null;
}
