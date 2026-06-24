import type { Rendition } from 'epubjs';

import { copyToClipboard } from '@/utils/clipboard';
import { resolveSelectionCfiRange } from './epubRangeGeometry';

type EpubIframeContents = {
	document: Document;
	window: Window;
};

export type EpubReaderContextMenuPayload = {
	clientX: number;
	clientY: number;
	selectedText: string;
	cfiRange?: string;
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

function clearWindowSelection(win: Window): void {
	try {
		win.getSelection()?.removeAllRanges();
	} catch {
		// iframe 已卸载时忽略
	}
}

/**
 * 在 epub.js 各章节 iframe 内拦截原生右键菜单，并上报选区与视口坐标。
 * - 需在 rendition 创建后、destroy 前调用
 * - 返回的 detach 会移除挂载的监听，避免泄漏
 *
 * 主要流程：
 * 1. 渲染 epub 内容的每个 iframe（章节）挂载 right-mousedown 和 contextmenu；
 * 2. 判断用户是主动选区还是浏览器“右键自动点词/选词”；
 * 3. 若为后者，主动清理浏览器临时选区，右键菜单 payload 保持空文本；
 * 4. 若为主动选区，提取文本和 CFI range，回调给上层逻辑；
 * 5. 支持多章节增量挂载和批量解绑。
 */
export function attachEpubIframeContextMenu(
	rend: Rendition,
	onMenu: (payload: EpubReaderContextMenuPayload) => void,
): () => void {
	const cleanups = new Map<EpubIframeContents, () => void>();

	/**
	 * 在单个章节 iframe 内注册 contextmenu/右键监听
	 * @param contents EpubIframeContents
	 */
	const bindContents = (contents: EpubIframeContents) => {
		if (cleanups.has(contents)) return; // 已处理，无需重复挂载
		const doc = contents.document;
		const win = contents.window;

		/**
		 * 标记右键按下前是否已有用户主动选区
		 * - 有：说明是“先选中-再右键”→后续可以弹出菜单操作
		 * - 无：大概率是“右键自动点词/浏览器自动选词”→只展示菜单不带选中内容
		 */
		let hadSelectionBeforeRightClick = false;

		/**
		 * 右键按下时，检查当前是否已有选区
		 * - button === 2 表示右键
		 * - 只有先手动选中才会有选区，避免与浏览器右键自动选词混淆
		 */
		const onRightMouseDown = (e: MouseEvent) => {
			if (e.button !== 2) return;
			hadSelectionBeforeRightClick = Boolean(readSelectionText(win));
		};

		/**
		 * 拦截 contextmenu 事件，决定如何上报选区及弹出菜单
		 * 1. 判断是否浏览器自动选词
		 * 2. 如果自动选词则清理当前选区；否则读取当前用户选区
		 * 3. 若有有效选区，尝试解析 CFI range；否则 cfiRange 为 undefined
		 * 4. 统一上报弹出菜单的屏幕坐标与数据
		 * 5. 提供 copySelection 回调，便于菜单“复制选区”按钮调用
		 */
		const onCtx = (e: MouseEvent) => {
			e.preventDefault(); // 阻止默认右键菜单
			e.stopPropagation(); // 避免事件冒泡顶层

			// 若不是主动选区，说明触发了浏览器自动选词
			const browserAutoSelected = !hadSelectionBeforeRightClick;
			hadSelectionBeforeRightClick = false; // 状态重置（无论哪种情况）

			// 浏览器自动选词时主动清除该无意义选区，PopMenu 只显示“无内容”
			if (browserAutoSelected) {
				clearWindowSelection(win);
			}

			// 若是主动选区，则读取选中文本，否则为空字符串
			const selectedText = browserAutoSelected ? '' : readSelectionText(win);

			let cfiRange: string | undefined;
			const sel = win.getSelection();
			if (sel && sel.rangeCount > 0) {
				const range = sel.getRangeAt(0);
				// 不是 collapsed 的有效选区才解析 cfiRange
				if (!range.collapsed) {
					cfiRange = resolveSelectionCfiRange(rend, win, range);
				}
			}
			// 计算菜单弹出坐标（iframe 内坐标映射到主页面视口）
			const { x, y } = toViewportPoint(e, win);

			// 回调上报菜单弹窗 payload，供上层展示自定义右键菜单
			onMenu({
				clientX: x,
				clientY: y,
				selectedText,
				cfiRange,
				copySelection: () => {
					const text = readSelectionText(win);
					if (!text) return;
					void copyToClipboard(text); // 支持菜单一键复制
				},
			});
		};

		// 捕获阶段（true）挂载监听，确保优先生效
		doc.addEventListener('mousedown', onRightMouseDown, true);
		doc.addEventListener('contextmenu', onCtx);
		// 记录解绑函数，便于批量清理
		cleanups.set(contents, () => {
			doc.removeEventListener('mousedown', onRightMouseDown, true);
			doc.removeEventListener('contextmenu', onCtx);
		});
	};

	// 动态响应 epub.js 挂载的章节内容
	rend.hooks.content.register(bindContents);

	// 初始已挂载的章节 iframe 需要立即注册
	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item as EpubIframeContents);
	} else if (existing) {
		bindContents(existing as EpubIframeContents);
	}

	// 返回 detach: 调用后解绑所有已注册监听，防止泄漏
	return () => {
		for (const fn of cleanups.values()) fn();
		cleanups.clear();
	};
}

/**
 * 监听 epub.js 各章节 iframe 内的 pointer 按下（用于关闭浮层等）。
 * iframe 内事件不会冒泡到顶层，需单独挂载。
 */
export function attachEpubIframePointerDown(
	rend: Rendition,
	onPointerDown: () => void,
): () => void {
	const cleanups = new Map<EpubIframeContents, () => void>();

	const bindContents = (contents: EpubIframeContents) => {
		if (cleanups.has(contents)) return;
		const doc = contents.document;
		const handler = () => onPointerDown();
		doc.addEventListener('mousedown', handler, true);
		cleanups.set(contents, () =>
			doc.removeEventListener('mousedown', handler, true),
		);
	};

	rend.hooks.content.register(bindContents);

	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item as EpubIframeContents);
	} else if (existing) {
		bindContents(existing as EpubIframeContents);
	}

	return () => {
		for (const fn of cleanups.values()) fn();
		cleanups.clear();
	};
}
