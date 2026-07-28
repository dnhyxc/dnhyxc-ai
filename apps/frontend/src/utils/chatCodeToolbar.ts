/**
 * 聊天代码块工具栏：ScrollArea 等祖先的 overflow 会使 sticky/fixed 参照系异常，
 * 故将「吸顶」工具栏通过 Portal 挂到 document.body，用视口坐标 position:fixed，
 * 由 `layoutChatCodeToolbars(viewport)` 在滚动/resize/内容变化时更新几何。
 * React 侧推荐用 `useChatCodeFloatingToolbar`（`@/hooks/useChatCodeFloatingToolbar`）统一注册监听并渲染 `ChatCodeFloatingToolbar`。
 *
 * 长文多代码块：滚动热路径禁止全文 querySelectorAll / 全量 getBoundingClientRect；
 * 块列表在内容变化时刷新，滚动帧复用缓存 + 二分定位视口顶附近块。
 */

import {
	downloadMarkdownCodeFenceWith,
	getMarkdownCodeFenceInfo,
	getMarkdownCodeFencePlainText,
	MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS,
	MARKDOWN_CODE_FENCE_TOOLBAR_LANG_SELECTOR,
	MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR,
	MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR,
	queryMarkdownCodeFenceBlockRoots,
} from '@dnhyxc-ai/markdown-kit';
import { downloadBlob } from '.';
import { findFirstBlockNotAboveViewportTop } from './chatCodeFencePinSearch';

export { findFirstBlockNotAboveViewportTop } from './chatCodeFencePinSearch';

/**
 * 宿主（聊天）消息气泡壳：用于浮动条水平对齐参照。
 * 说明：**非** `MarkdownParser` 输出；由前端消息布局约定，故保留在本文件而非 `@dnhyxc-ai/markdown-kit`。
 */
const CHAT_ASSISTANT_SHELL_SELECTOR = '[data-chat-assistant-shell]';

export type ChatCodeFloatingToolbarState = {
	visible: boolean;
	top: number;
	left: number;
	width: number;
	lang: string;
	pinId: number;
};

const HIDDEN: ChatCodeFloatingToolbarState = {
	visible: false,
	top: 0,
	left: 0,
	width: 0,
	lang: '',
	pinId: -1,
};

let state: ChatCodeFloatingToolbarState = HIDDEN;
const listeners = new Set<() => void>();
let pinSession = 0;

const PIN_ATTR = 'data-chat-toolbar-pin';

/** 滚动帧复用：内容变化时 invalidate / refreshBlocks */
const blockListCache = new WeakMap<HTMLElement, HTMLElement[]>();

/** 上一次吸顶 winner；滚动热路径只清这一处 */
let lastPinnedMarkers: {
	block: HTMLElement;
	toolbar: HTMLElement;
	slot: HTMLElement;
} | null = null;

function emit(): void {
	for (const fn of listeners) {
		fn();
	}
}

function hideToolbar(emitIfChanged = true): void {
	clearLastPinnedMarkers();
	if (!state.visible && state.pinId < 0) return;
	state = HIDDEN;
	if (emitIfChanged) emit();
}

/**
 * 供 React 的 `useSyncExternalStore`（外部状态订阅）订阅浮动工具栏状态变更。
 *
 * - **为什么用订阅模型**：浮动工具栏是“计算几何 + 写入全局 state”的结果，不属于某个 React 组件私有 state；
 *   用订阅模型可以让任何地方（Portal 渲染的工具栏、或调试面板）都能同步读取到当前 pinned 状态。
 * - **返回值**：用于取消订阅的函数。
 */
export function subscribeChatCodeFloatingToolbar(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

/**
 * 读取当前吸顶浮动工具栏快照（snapshot，快照）。
 *
 * - 供 `useSyncExternalStore` 的 `getSnapshot` 使用
 * - 不会触发重新计算；仅返回最近一次 `layoutChatCodeToolbars(...)` 写入的结果
 */
export function getChatCodeFloatingToolbarSnapshot(): ChatCodeFloatingToolbarState {
	return state;
}

/** 正文 DOM 变化后丢弃块列表缓存（由 hook 在 layoutDeps 变化时调用） */
export function invalidateChatCodeFenceBlockCache(
	viewport?: HTMLElement | null,
): void {
	if (viewport) blockListCache.delete(viewport);
}

function clearLastPinnedMarkers(): void {
	const prev = lastPinnedMarkers;
	lastPinnedMarkers = null;
	if (!prev?.block.isConnected) return;
	prev.block.removeAttribute(PIN_ATTR);
	prev.toolbar.classList.remove(
		MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS,
	);
	prev.slot.style.minHeight = '';
}

/**
 * 计算吸顶浮动条在视口内的水平范围（left/width）。
 *
 * 目标：
 * - 尽量与“当前代码块在视口内可见部分”的水平区间对齐；
 * - 若代码块本身太窄/几乎不可见，则回退到“消息气泡壳”的水平区间，避免浮动条宽度为 0 或闪烁。
 */
function computePinnedBarBox(
	shellRect: DOMRectReadOnly,
	blockRect: DOMRectReadOnly,
	vpRect: DOMRectReadOnly,
): { left: number; width: number } {
	const cl = Math.max(vpRect.left, blockRect.left);
	const cr = Math.min(vpRect.right, blockRect.right);
	let left = cl;
	let width = cr - cl;
	if (width < 8) {
		const innerL = Math.max(vpRect.left, shellRect.left);
		const innerR = Math.min(vpRect.right, shellRect.right);
		left = innerL;
		width = Math.max(innerR - innerL, 0);
	}
	return { left, width };
}

export type LayoutChatCodeToolbarsOptions = {
	/** true：强制重新 query 代码块根（正文变化后）；滚动帧勿传 */
	refreshBlocks?: boolean;
};

/**
 * 在滚动视口内选出「跨越视口顶边」的代码块中顶边最靠下者，将浮动工具栏固定到视口顶。
 *
 * 关键约定（DOM 契约由 `@dnhyxc-ai/markdown-kit` 的 `markdown/code-fence-dom` 与 `MarkdownParser` 同源维护）：
 * - 代码块根：`queryMarkdownCodeFenceBlockRoots` / `MARKDOWN_CODE_FENCE_BLOCK_ROOT_SELECTOR`
 * - 行内工具栏：`MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR`
 * - 占位槽：`MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR`
 * - 气泡水平参照：`CHAT_ASSISTANT_SHELL_SELECTOR`（仅聊天；见本文件常量注释）
 *
 * 选择规则（为什么要选“顶边最靠下”的那个）：
 * - 当视口顶边同时落在多个代码块内部（例如连续多个短代码块）时，
 *   “顶边最靠下”对应用户当前阅读位置最接近的代码块，吸顶工具栏更符合直觉。
 *
 * 输出：
 * - 写入全局 `state`，由 Portal 的 `ChatCodeToolBar/index.tsx` 渲染到 `document.body`
 * - 仅写几何数据（top/left/width）与 `pinId`，避免持有 DOM 引用
 */
export function layoutChatCodeToolbars(
	viewport: HTMLElement | null,
	options?: LayoutChatCodeToolbarsOptions,
): void {
	if (!viewport) {
		hideToolbar();
		return;
	}

	const vpRect = viewport.getBoundingClientRect();
	const PIN_EPS = 1;
	const topY = vpRect.top + PIN_EPS;

	let list = blockListCache.get(viewport);
	if (!list || options?.refreshBlocks) {
		list = Array.from(queryMarkdownCodeFenceBlockRoots(viewport));
		blockListCache.set(viewport, list);
	}

	// 过滤已卸节点：有失效则整表刷新（避免滚动中半残缓存）
	if (list.some((el) => !el.isConnected)) {
		list = Array.from(queryMarkdownCodeFenceBlockRoots(viewport));
		blockListCache.set(viewport, list);
	}

	if (list.length === 0) {
		hideToolbar();
		return;
	}

	type Scored = {
		block: HTMLElement;
		br: DOMRect;
		shell: HTMLElement;
		toolbar: HTMLElement;
		slot: HTMLElement;
	};

	const midBottoms = new Map<number, number>();
	const getBottom = (index: number) => {
		let b = midBottoms.get(index);
		if (b == null) {
			b = list[index].getBoundingClientRect().bottom;
			midBottoms.set(index, b);
		}
		return b;
	};

	const start = findFirstBlockNotAboveViewportTop(
		getBottom,
		list.length,
		topY - PIN_EPS,
	);

	const candidates: Scored[] = [];
	for (let i = start; i < list.length; i++) {
		const block = list[i];
		const toolbar = block.querySelector<HTMLElement>(
			MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR,
		);
		const slot = block.querySelector<HTMLElement>(
			MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR,
		);
		if (!toolbar || !slot) continue;
		const br = block.getBoundingClientRect();
		// 顶边已低于视口顶：其后块更低，结束
		if (br.top >= topY) break;
		if (br.bottom > topY) {
			candidates.push({
				block,
				br,
				shell:
					block.closest<HTMLElement>(CHAT_ASSISTANT_SHELL_SELECTOR) ?? viewport,
				toolbar,
				slot,
			});
		}
	}

	if (candidates.length === 0) {
		hideToolbar();
		return;
	}

	const winner = candidates.reduce((a, b) => (a.br.top > b.br.top ? a : b));
	const shellRect = winner.shell.getBoundingClientRect();
	const { left, width } = computePinnedBarBox(shellRect, winner.br, vpRect);
	const langSpan = winner.block.querySelector(
		MARKDOWN_CODE_FENCE_TOOLBAR_LANG_SELECTOR,
	);
	const lang = langSpan?.textContent?.trim() || 'text';
	const top = vpRect.top;

	// 同一块且几何未变：跳过 setAttribute / emit，避免滚动帧订阅方重渲
	if (
		lastPinnedMarkers?.block === winner.block &&
		state.visible &&
		state.top === top &&
		state.left === left &&
		state.width === width &&
		state.lang === lang
	) {
		return;
	}

	clearLastPinnedMarkers();
	const pinId = ++pinSession;
	winner.block.setAttribute(PIN_ATTR, String(pinId));
	winner.toolbar.classList.add(
		MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS,
	);
	const th = winner.toolbar.offsetHeight || 36;
	winner.slot.style.minHeight = `${th}px`;
	lastPinnedMarkers = {
		block: winner.block,
		toolbar: winner.toolbar,
		slot: winner.slot,
	};

	state = {
		visible: true,
		top,
		left,
		width,
		lang,
		pinId,
	};
	emit();
}

const LANG_TO_EXT: Record<string, string> = {
	typescript: 'ts',
	ts: 'ts',
	tsx: 'tsx',
	javascript: 'js',
	js: 'js',
	jsx: 'jsx',
	json: 'json',
	python: 'py',
	py: 'py',
	rust: 'rs',
	rs: 'rs',
	go: 'go',
	java: 'java',
	html: 'html',
	css: 'css',
	md: 'md',
	markdown: 'md',
	yaml: 'yml',
	yml: 'yml',
	sh: 'sh',
	bash: 'sh',
};

/**
 * 语言名 → 文件扩展名（extension，扩展名）。
 *
 * - 用于下载时生成更友好的文件名
 * - 对未知语言做安全回退：若语言名包含非安全字符则退回 `txt`
 */
export function fileExtension(lang: string): string {
	const key = lang.toLowerCase().trim();
	if (!key) return 'txt';
	return LANG_TO_EXT[key] || (/^[a-z0-9+.#-]{1,24}$/i.test(key) ? key : 'txt');
}

/**
 * 从一个代码块根节点中提取纯文本源码。
 *
 * 约定结构：与 `MarkdownParser.patchChatCodeFenceRenderer`、`getMarkdownCodeFencePlainText`（工具包内 `MARKDOWN_CODE_FENCE_SOURCE_CODE_SELECTOR`）一致。
 *
 * 注意：这里取的是 `textContent`，用于复制/下载时确保拿到“用户看到的纯文本”，
 * 不依赖 highlight.js 输出的 HTML（避免夹带标签）。
 */
export function getChatCodeBlockPlainText(block: HTMLElement): string {
	return getMarkdownCodeFencePlainText(block);
}

/**
 * 根据 pinId 获取当前 pinned 的代码块 DOM。
 *
 * pinId 由 `layoutChatCodeToolbars(...)` 选出 winner 后写入：
 * - `winner.block.setAttribute(PIN_ATTR, String(pinId))`
 *
 * 之所以用属性而不是直接缓存 DOM：
 * - 避免持有旧 DOM 引用导致内存泄漏
 * - DOM 被 React 重建后依然可通过选择器重新定位
 */
export function getPinnedChatCodeBlock(pinId: number): HTMLElement | null {
	if (pinId < 0) return null;
	return document.querySelector<HTMLElement>(`[${PIN_ATTR}="${pinId}"]`);
}

/**
 * 下载当前代码块源码（供“代码块工具栏/吸顶工具栏”的下载按钮调用）。
 *
 * 设计拆分：
 * - **工具包负责**：从 DOM 提取 `{code/lang/filename}` 并将 `code` 封装成 `Blob`
 * - **宿主负责**：用项目统一的下载能力 `downloadBlob(...)` 完成落盘（Web/Tauri/Electron 等）
 *
 * 说明：
 * - `_lang` 参数保留是为了兼容旧调用签名；实际语言以 `getMarkdownCodeFenceInfo` 从 DOM（`MARKDOWN_CODE_FENCE_TOOLBAR_LANG_SELECTOR`）解析为准
 * - 文件名策略：`code_<时间戳>.<ext>`
 */
export async function downloadChatCodeBlock(block: HTMLElement, _lang: string) {
	const info = getMarkdownCodeFenceInfo(block, {
		getFilename(baseInfo) {
			return `code_${Date.now()}.${baseInfo.fileExtension}`;
		},
	});
	await downloadMarkdownCodeFenceWith(info, async (task) => {
		await downloadBlob(
			{
				file_name: task.filename,
				id: Date.now().toString(),
				overwrite: true,
			},
			task.blob,
		);
	});
}
