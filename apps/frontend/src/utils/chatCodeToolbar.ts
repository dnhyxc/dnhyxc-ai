/**
 * 聊天代码块工具栏：ScrollArea 等祖先的 overflow 会使 sticky/fixed 参照系异常，
 * 故将「吸顶」工具栏通过 Portal 挂到 document.body，用视口坐标 position:fixed，
 * 由 `layoutChatCodeToolbars(viewport)` 在滚动/resize/内容变化时更新几何。
 * React 侧推荐用 `useChatCodeFloatingToolbar`（`@/hooks/useChatCodeFloatingToolbar`）统一注册监听并渲染 `ChatCodeFloatingToolbar`。
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
} from '@dnhyxc-ai/tools';
import { downloadBlob } from '.';

/**
 * 宿主（聊天）消息气泡壳：用于浮动条水平对齐参照。
 * 说明：**非** `MarkdownParser` 输出；由前端消息布局约定，故保留在本文件而非 `@dnhyxc-ai/tools`。
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

function emit(): void {
	for (const fn of listeners) {
		fn();
	}
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

/**
 * 清理 viewport 内上一次布局写入的标记，避免滚动时残留“旧 pinned”状态。
 *
 * 清理内容包括：
 * - `PIN_ATTR`：标记“当前 pinned 的代码块”
 * - `MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS`：让原 toolbar 隐形/让位给浮动条的 class（与 `@dnhyxc-ai/tools` 导出一致）
 * - 占位槽 `MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR` 的 `minHeight`：用于占位，防止原 toolbar 被浮动条替换后导致布局跳动
 */
function resetFloatingMarkersInViewport(viewport: HTMLElement): void {
	viewport.querySelectorAll(`[${PIN_ATTR}]`).forEach((el) => {
		el.removeAttribute(PIN_ATTR);
	});
	viewport
		.querySelectorAll(MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR)
		.forEach((tb) => {
			tb.classList.remove(MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS);
		});
	viewport
		.querySelectorAll(MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR)
		.forEach((slot) => {
			(slot as HTMLElement).style.minHeight = '';
		});
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

/**
 * 在滚动视口内选出「跨越视口顶边」的代码块中顶边最靠下者，将浮动工具栏固定到视口顶。
 *
 * 关键约定（DOM 契约由 `@dnhyxc-ai/tools` 的 `markdown-code-fence-dom.ts` 与 `MarkdownParser` 同源维护）：
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
export function layoutChatCodeToolbars(viewport: HTMLElement | null): void {
	// 无 viewport：直接隐藏浮动条（例如组件卸载或 ref 为空）
	if (!viewport) {
		// 写入隐藏状态
		state = HIDDEN;
		// 通知订阅方刷新（Portal 工具栏会随之消失）
		emit();
		// 提前返回，避免后续对 null 读几何
		return;
	}

	// 读取滚动视口矩形：用于判断“视口顶边”与代码块的相交关系，并计算浮动条 top
	const vpRect = viewport.getBoundingClientRect();
	// 清掉上一次 pinned 标记与占位，避免滚动/重算后残留旧状态
	resetFloatingMarkersInViewport(viewport);

	// 收集 viewport 内所有代码块容器（与 MarkdownParser.patchChatCodeFenceRenderer 输出一致）
	const blocks = queryMarkdownCodeFenceBlockRoots(viewport);
	// 评分结构：把每个代码块参与决策所需信息一次性取齐（避免后面反复查询 DOM）
	type Scored = {
		// 代码块容器节点
		block: HTMLElement;
		// 代码块容器的几何快照（rect，矩形）
		br: DOMRect;
		// “消息气泡壳”或回退到 viewport：用于计算浮动条的水平范围
		shell: HTMLElement;
		// 原始工具栏节点（会被标记为 replaced-by-float）
		toolbar: HTMLElement;
		// 工具栏占位槽节点（用于写 minHeight，防止布局跳动）
		slot: HTMLElement;
	};
	// scored：所有满足结构要求的代码块集合
	const scored: Scored[] = [];

	// 遍历每个代码块，抽取工具栏、占位槽、几何与壳节点
	for (const block of blocks) {
		// 代码块内原始工具栏（与工具包契约一致）
		const toolbar = block.querySelector<HTMLElement>(
			MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR,
		);
		// 工具栏占位槽（与工具包契约一致）
		const slot = block.querySelector<HTMLElement>(
			MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR,
		);
		// 聊天气泡壳（宿主布局）：知识库/独立 Markdown 预览无该节点，用滚动视口作水平参照
		// shell：用于水平对齐的参照容器（优先消息气泡壳，否则用 viewport）
		const shell =
			block.closest<HTMLElement>(CHAT_ASSISTANT_SHELL_SELECTOR) ?? viewport;
		// 缺少关键节点则跳过（不参与吸顶）
		if (!toolbar || !slot) continue;
		// 记录本代码块的评分信息
		scored.push({
			// 原始代码块容器
			block,
			// 代码块矩形：用于筛选“跨越视口顶边”的候选
			br: block.getBoundingClientRect(),
			// 参照壳：用于计算 left/width
			shell,
			// 原工具栏：用于写 class
			toolbar,
			// 占位槽：用于写 minHeight
			slot,
		});
	}

	// 允许 1px 的误差：避免因为亚像素/滚动舍入导致候选集合抖动
	const PIN_EPS = 1;
	// candidates：筛选出“视口顶边落在其内部”的代码块（跨越视口顶边）
	const candidates = scored.filter(
		(s) =>
			s.br.top < vpRect.top + PIN_EPS && s.br.bottom > vpRect.top + PIN_EPS,
	);

	// 没有候选：说明视口顶边不在任何代码块内部 → 隐藏浮动条
	if (candidates.length === 0) {
		// 写入隐藏状态
		state = HIDDEN;
		// 通知订阅方刷新
		emit();
		// 提前返回
		return;
	}

	// winner：在所有候选里选择“顶边更靠下”的那个（更贴近当前阅读位置）
	const winner = candidates.reduce((a, b) => (a.br.top > b.br.top ? a : b));
	// pinId：自增会话 id，用于在 DOM 上标记“当前 pinned 的代码块”
	const pinId = ++pinSession;
	// 在 winner 代码块上打标：方便浮动工具栏通过 pinId 反查对应 block
	winner.block.setAttribute(PIN_ATTR, String(pinId));
	// 标记原工具栏“已被浮动条替换”：通常用于样式隐藏/占位切换
	winner.toolbar.classList.add(
		MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS,
	);
	// 读取原工具栏高度：用于设置 slot 的占位高度，避免内容突然上跳
	const th = winner.toolbar.offsetHeight || 36;
	// 写入占位高度：原工具栏被“替换”后仍保持同等高度的空位
	winner.slot.style.minHeight = `${th}px`;

	// 读取壳节点矩形：用于计算浮动条 left/width 的对齐区间
	const shellRect = winner.shell.getBoundingClientRect();
	// 计算浮动条在视口内的水平位置与宽度（优先对齐代码块可见区间）
	const { left, width } = computePinnedBarBox(shellRect, winner.br, vpRect);
	// 从代码块里读语言标签：用于浮动工具栏显示（不作为下载真实语言源）
	const langSpan = winner.block.querySelector(
		MARKDOWN_CODE_FENCE_TOOLBAR_LANG_SELECTOR,
	);
	// 语言文本：空值回退为 text
	const lang = langSpan?.textContent?.trim() || 'text';

	// 写入浮动条状态：由 Portal 工具栏读取并渲染到 body
	state = {
		// 可见
		visible: true,
		// 顶部固定到 viewport 顶边（position:fixed 参照）
		top: vpRect.top,
		// 水平位置
		left,
		// 宽度
		width,
		// 展示用语言标签
		lang,
		// 用于反查 pinned block 的 id
		pinId,
	};
	// 通知订阅方刷新 UI
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
