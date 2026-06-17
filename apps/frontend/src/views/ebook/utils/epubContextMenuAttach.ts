import type { Rendition } from 'epubjs';

type EpubIframeContents = {
	document: Document;
	window: Window;
};

import { copyToClipboard } from '@/utils/clipboard';

export type EpubReaderContextMenuPayload = {
	clientX: number;
	clientY: number;
	selectedText: string;
	copySelection: () => void;
};

function toViewportPoint(e: MouseEvent, win: Window): { x: number; y: number } {
	const iframe = win.frameElement as HTMLIFrameElement | null;
	const rect = iframe?.getBoundingClientRect();
	return {
		x: rect ? e.clientX + rect.left : e.clientX,
		y: rect ? e.clientY + rect.top : e.clientY,
	};
}

function readSelectionText(win: Window): string {
	return (win.getSelection()?.toString() ?? '').trim();
}

/**
 * 在 epub.js 各章节 iframe 内拦截原生右键菜单，并上报选区与视口坐标。
 * 需在 rendition 创建后、destroy 前调用；返回的 detach 会移除已挂载章节的监听。
 */
export function attachEpubIframeContextMenu(
	rend: Rendition,
	onMenu: (payload: EpubReaderContextMenuPayload) => void,
): () => void {
	const cleanups = new Map<EpubIframeContents, () => void>();

	const bindContents = (contents: EpubIframeContents) => {
		if (cleanups.has(contents)) return;
		const doc = contents.document;
		const win = contents.window;

		const onCtx = (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			const selectedText = readSelectionText(win);
			const { x, y } = toViewportPoint(e, win);
			onMenu({
				clientX: x,
				clientY: y,
				selectedText,
				copySelection: () => {
					const text = readSelectionText(win);
					if (!text) return;
					void copyToClipboard(text);
				},
			});
		};

		doc.addEventListener('contextmenu', onCtx);
		cleanups.set(contents, () => doc.removeEventListener('contextmenu', onCtx));
	};

	rend.hooks.content.register(bindContents);

	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item);
	} else if (existing) {
		bindContents(existing);
	}

	return () => {
		for (const fn of cleanups.values()) fn();
		cleanups.clear();
	};
}
