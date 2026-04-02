/**
 * 聊天代码块工具栏：ScrollArea 等祖先的 overflow 会使 sticky/fixed 参照系异常，
 * 故将「吸顶」工具栏通过 Portal 挂到 document.body，用视口坐标 position:fixed，
 * 由 `layoutChatCodeToolbars(viewport)` 在滚动/resize/内容变化时更新几何。
 * React 侧推荐用 `useChatCodeFloatingToolbar`（`@/hooks/useChatCodeFloatingToolbar`）统一注册监听并渲染 `ChatCodeFloatingToolbar`。
 */

import { downloadBlob } from '.';

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

/** 供 React useSyncExternalStore 订阅浮动条状态 */
export function subscribeChatCodeFloatingToolbar(fn: () => void): () => void {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

export function getChatCodeFloatingToolbarSnapshot(): ChatCodeFloatingToolbarState {
	return state;
}

function resetFloatingMarkersInViewport(viewport: HTMLElement): void {
	viewport.querySelectorAll(`[${PIN_ATTR}]`).forEach((el) => {
		el.removeAttribute(PIN_ATTR);
	});
	viewport.querySelectorAll('.chat-md-code-toolbar').forEach((tb) => {
		tb.classList.remove('chat-md-code-toolbar--replaced-by-float');
	});
	viewport.querySelectorAll('.chat-md-code-toolbar-slot').forEach((slot) => {
		(slot as HTMLElement).style.minHeight = '';
	});
}

/** 与消息气泡、代码块在视口内的交集对齐水平范围 */
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
 */
export function layoutChatCodeToolbars(viewport: HTMLElement | null): void {
	if (!viewport) {
		state = HIDDEN;
		emit();
		return;
	}

	const vpRect = viewport.getBoundingClientRect();
	resetFloatingMarkersInViewport(viewport);

	const blocks = viewport.querySelectorAll<HTMLElement>(
		'[data-chat-code-block]',
	);
	type Scored = {
		block: HTMLElement;
		br: DOMRect;
		shell: HTMLElement;
		toolbar: HTMLElement;
		slot: HTMLElement;
	};
	const scored: Scored[] = [];

	for (const block of blocks) {
		const toolbar = block.querySelector<HTMLElement>('.chat-md-code-toolbar');
		const slot = block.querySelector<HTMLElement>('.chat-md-code-toolbar-slot');
		// 聊天气泡内有 data-chat-assistant-shell；知识库/独立 Markdown 预览无该节点，用滚动视口作水平参照
		const shell =
			block.closest<HTMLElement>('[data-chat-assistant-shell]') ?? viewport;
		if (!toolbar || !slot) continue;
		scored.push({
			block,
			br: block.getBoundingClientRect(),
			shell,
			toolbar,
			slot,
		});
	}

	const PIN_EPS = 1;
	const candidates = scored.filter(
		(s) =>
			s.br.top < vpRect.top + PIN_EPS && s.br.bottom > vpRect.top + PIN_EPS,
	);

	if (candidates.length === 0) {
		state = HIDDEN;
		emit();
		return;
	}

	const winner = candidates.reduce((a, b) => (a.br.top > b.br.top ? a : b));
	const pinId = ++pinSession;
	winner.block.setAttribute(PIN_ATTR, String(pinId));
	winner.toolbar.classList.add('chat-md-code-toolbar--replaced-by-float');
	const th = winner.toolbar.offsetHeight || 36;
	winner.slot.style.minHeight = `${th}px`;

	const shellRect = winner.shell.getBoundingClientRect();
	const { left, width } = computePinnedBarBox(shellRect, winner.br, vpRect);
	const langSpan = winner.block.querySelector('.chat-md-code-lang');
	const lang = langSpan?.textContent?.trim() || 'text';

	state = {
		visible: true,
		top: vpRect.top,
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

export function fileExtension(lang: string): string {
	const key = lang.toLowerCase().trim();
	if (!key) return 'txt';
	return LANG_TO_EXT[key] || (/^[a-z0-9+.#-]{1,24}$/i.test(key) ? key : 'txt');
}

export function getChatCodeBlockPlainText(block: HTMLElement): string {
	const code = block.querySelector('pre code');
	return code?.textContent ?? '';
}

export function getPinnedChatCodeBlock(pinId: number): HTMLElement | null {
	if (pinId < 0) return null;
	return document.querySelector<HTMLElement>(`[${PIN_ATTR}="${pinId}"]`);
}

export async function downloadChatCodeBlock(block: HTMLElement, lang: string) {
	const text = getChatCodeBlockPlainText(block);
	const ext = fileExtension(lang);
	const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
	await downloadBlob(
		{
			file_name: `code_${Date.now()}.${ext}`,
			id: Date.now().toString(),
			overwrite: true,
		},
		blob,
	);
}
