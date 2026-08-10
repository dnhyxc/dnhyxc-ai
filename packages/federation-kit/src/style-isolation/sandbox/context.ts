/**
 * 样式捕获窗口上下文（嵌套 begin/attach 用栈）。
 * 挂 globalThis：主入口与 ./react 双份打包时必须共用同一栈。
 */
export type CaptureCtx = {
	pluginId: string;
	/** realm / mfStyleOwner 键：同一 Remote 多插件共享 */
	realm: string;
	entryOrigin: string;
	/**
	 * true（loadRemote 短窗）：允许认领窗口内无标记的新 style（Remote 入口 CSS）。
	 * false（挂载长窗）：只认有 Remote 正信号的节点，避免误收 Host 全局样式。
	 */
	claimUnmarked: boolean;
};

const CAPTURE_KEY = '__dnhyxc_ai_federation_style_capture__';

type CaptureBag = {
	stack: CaptureCtx[];
};

type GlobalBag = typeof globalThis & {
	[CAPTURE_KEY]?: CaptureBag;
};

function store(): CaptureBag {
	const g = globalThis as GlobalBag;
	if (!g[CAPTURE_KEY]) {
		g[CAPTURE_KEY] = { stack: [] };
	}
	return g[CAPTURE_KEY]!;
}

/** 与 store 同源；各入口 import 后仍是同一数组 */
export const captureStack = store().stack;

export function activeCtx(): CaptureCtx | null {
	const stack = store().stack;
	return stack[stack.length - 1] ?? null;
}
