import type { Rendition } from 'epubjs';
import { resolveSelectionCfiRange } from './epubRangeGeometry';
import { getEpubScrollContainer } from './epubScrolledNav';

type EpubIframeContents = {
	document: Document;
	window: Window;
};

export type EpubSelectionPopBarPayload = {
	/** 选区水平中心（相对视口，px） */
	x: number;
	/** 选区顶边（相对视口，px）；工具栏显示在其上方 */
	y: number;
	selectedText: string;
	cfiRange?: string;
};

/** 划线/想法 mark 点击打开 PopBar 后，避免选区监听误关 */
let suppressDismissUntil = 0;

export function suppressEpubSelectionPopBarDismiss(ms = 450): void {
	suppressDismissUntil = Date.now() + ms;
}

function shouldSuppressDismiss(): boolean {
	return Date.now() < suppressDismissUntil;
}

function readSelectionText(win: Window): string {
	return (win.getSelection()?.toString() ?? '').trim();
}

/** 清除 rendition 各 iframe 及顶层的文字选区 */
export function clearEpubTextSelection(rend: Rendition): void {
	const raw = rend.getContents();
	const list: EpubIframeContents[] = Array.isArray(raw)
		? (raw as EpubIframeContents[])
		: raw
			? [raw as EpubIframeContents]
			: [];

	for (const contents of list) {
		try {
			contents.window.getSelection()?.removeAllRanges();
		} catch {
			// iframe 已卸载时忽略
		}
	}
	try {
		window.getSelection()?.removeAllRanges();
	} catch {
		// ignore
	}
}

function toIframeViewportOffset(win: Window): { x: number; y: number } {
	const iframe = win.frameElement as HTMLIFrameElement | null;
	const iframeRect = iframe?.getBoundingClientRect();
	return {
		x: iframeRect?.left ?? 0,
		y: iframeRect?.top ?? 0,
	};
}

function isSelectionBackward(sel: Selection): boolean {
	if (!sel.anchorNode || !sel.focusNode) return false;
	if (sel.anchorNode === sel.focusNode) {
		return sel.anchorOffset > sel.focusOffset;
	}
	return Boolean(
		sel.anchorNode.compareDocumentPosition(sel.focusNode) &
			Node.DOCUMENT_POSITION_PRECEDING,
	);
}

function readCollapsedRangeRect(
	range: Range,
	toStart: boolean,
): DOMRect | null {
	const caret = range.cloneRange();
	caret.collapse(toStart);
	const rects = [...caret.getClientRects()];
	for (const rect of rects) {
		if (rect.width > 0 && rect.height > 0) return rect;
	}
	const box = caret.getBoundingClientRect();
	if (box.width > 0 || box.height > 0) return box;
	if (box.top !== 0 || box.left !== 0 || box.bottom !== 0 || box.right !== 0) {
		return box;
	}
	return null;
}

function collectVisibleRangeRects(range: Range): DOMRect[] {
	return [...range.getClientRects()].filter(
		(rect) => rect.width > 0 && rect.height > 0,
	);
}

function unionRectBounds(rects: DOMRect[]) {
	let left = Number.POSITIVE_INFINITY;
	let top = Number.POSITIVE_INFINITY;
	let right = Number.NEGATIVE_INFINITY;
	for (const rect of rects) {
		left = Math.min(left, rect.left);
		top = Math.min(top, rect.top);
		right = Math.max(right, rect.right);
	}
	return { left, top, right };
}

/** 多行选区 / 划线：focus 行顶（仅非 collapsed 选区时） */
function resolvePopBarAnchorLineTop(
	win: Window,
	range: Range,
	visibleRects: DOMRect[],
): number {
	const sel = win.getSelection();
	if (sel && !sel.isCollapsed) {
		const focusRect = readCollapsedRangeRect(range, isSelectionBackward(sel));
		if (focusRect) return focusRect.top;
	}
	return visibleRects[0]!.top;
}

function rangeToViewportAnchor(
	win: Window,
	range: Range,
): { centerX: number; top: number } | null {
	const offset = toIframeViewportOffset(win);
	const visibleRects = collectVisibleRangeRects(range);

	if (visibleRects.length === 1) {
		const rect = visibleRects[0]!;
		return {
			centerX: offset.x + rect.left + rect.width / 2,
			top: offset.y + rect.top,
		};
	}

	if (visibleRects.length > 1) {
		const bounds = unionRectBounds(visibleRects);
		const lineTop = resolvePopBarAnchorLineTop(win, range, visibleRects);
		return {
			centerX: offset.x + (bounds.left + bounds.right) / 2,
			top: offset.y + lineTop,
		};
	}

	const startRect = readCollapsedRangeRect(range, true);
	const endRect = readCollapsedRangeRect(range, false);
	const fallback = startRect ?? endRect;
	if (!fallback) {
		const box = range.getBoundingClientRect();
		if (box.width === 0 && box.height === 0) return null;
		return {
			centerX: offset.x + box.left + box.width / 2,
			top: offset.y + box.top,
		};
	}

	const start = startRect ?? fallback;
	const end = endRect ?? fallback;
	return {
		centerX:
			offset.x +
			(Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2,
		top: offset.y + Math.min(start.top, end.top),
	};
}

function readActiveSelection(
	rend: Rendition,
): { win: Window; text: string; range: Range } | null {
	const raw = rend.getContents();
	const list: EpubIframeContents[] = Array.isArray(raw)
		? raw
		: raw
			? [raw as EpubIframeContents]
			: [];

	for (const contents of list) {
		const win = contents.window;
		const sel = win.getSelection();
		if (!sel || sel.rangeCount === 0) continue;
		const range = sel.getRangeAt(0);
		if (range.collapsed) continue;
		const text = readSelectionText(win);
		if (!text) continue;
		return { win, text, range };
	}
	return null;
}

/**
 * 监听 EPUB iframe 内文字选区；仅在松手（mouseup/touchend）后于选区上方中间上报，拖动过程中不展示。
 */
export function attachEpubSelectionPopBar(
	rend: Rendition,
	onChange: (payload: EpubSelectionPopBarPayload | null) => void,
): () => void {
	const contentCleanups = new Map<EpubIframeContents, () => void>();
	const scrollCleanups: (() => void)[] = [];
	const boundScrollContainers = new WeakSet<HTMLElement>();
	let rafId = 0;
	let keyboardEmitTimer = 0;
	let selecting = false;
	let suppressEmitUntil = 0;

	const hidePopBar = () => {
		if (shouldSuppressDismiss()) return;
		cancelAnimationFrame(rafId);
		rafId = 0;
		window.clearTimeout(keyboardEmitTimer);
		keyboardEmitTimer = 0;
		onChange(null);
	};

	const shouldSuppressEmit = () => Date.now() < suppressEmitUntil;

	const onScroll = () => {
		suppressEmitUntil = Date.now() + 350;
		hidePopBar();
	};

	const addScrollListener = (target: EventTarget) => {
		target.addEventListener('scroll', onScroll, {
			capture: true,
			passive: true,
		});
		scrollCleanups.push(() => {
			target.removeEventListener('scroll', onScroll, { capture: true });
		});
	};

	const bindEpubScrollContainer = () => {
		const container = getEpubScrollContainer(rend);
		if (!container || boundScrollContainers.has(container)) return;
		boundScrollContainers.add(container);
		addScrollListener(container);
	};

	const emitSelection = () => {
		if (shouldSuppressEmit()) {
			hidePopBar();
			return;
		}
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(() => {
			rafId = requestAnimationFrame(() => {
				if (shouldSuppressEmit()) {
					hidePopBar();
					return;
				}
				const active = readActiveSelection(rend);
				// 简单点击（无文字选区）不应关闭由划线 mark 打开的 PopBar
				if (!active) {
					return;
				}
				const anchor = rangeToViewportAnchor(active.win, active.range);
				if (!anchor) {
					onChange(null);
					return;
				}
				onChange({
					x: anchor.centerX,
					y: anchor.top,
					selectedText: active.text,
					cfiRange: resolveSelectionCfiRange(rend, active.win, active.range),
				});
			});
		});
	};

	const bindContents = (contents: EpubIframeContents) => {
		if (contentCleanups.has(contents)) return;
		const doc = contents.document;

		const onPointerDown = () => {
			selecting = true;
			hidePopBar();
		};

		const onPointerUp = () => {
			if (!selecting) return;
			selecting = false;
			emitSelection();
		};

		const onSelectionChange = () => {
			if (shouldSuppressEmit()) {
				hidePopBar();
				return;
			}
			if (!readActiveSelection(rend)) {
				// mousedown→click 定位光标时会先产生 collapsed 选区，此时 selecting 仍为 true
				if (selecting || shouldSuppressDismiss()) return;
				onChange(null);
				return;
			}
			if (selecting) return;
			window.clearTimeout(keyboardEmitTimer);
			keyboardEmitTimer = window.setTimeout(() => {
				if (selecting || shouldSuppressEmit()) return;
				emitSelection();
			}, 200);
		};

		const onContextMenu = () => hidePopBar();

		doc.addEventListener('mousedown', onPointerDown, true);
		doc.addEventListener('touchstart', onPointerDown, true);
		doc.addEventListener('mouseup', onPointerUp, true);
		doc.addEventListener('touchend', onPointerUp, true);
		doc.addEventListener('selectionchange', onSelectionChange);
		doc.addEventListener('contextmenu', onContextMenu, true);
		addScrollListener(doc);
		addScrollListener(contents.window);

		contentCleanups.set(contents, () => {
			doc.removeEventListener('mousedown', onPointerDown, true);
			doc.removeEventListener('touchstart', onPointerDown, true);
			doc.removeEventListener('mouseup', onPointerUp, true);
			doc.removeEventListener('touchend', onPointerUp, true);
			doc.removeEventListener('selectionchange', onSelectionChange);
			doc.removeEventListener('contextmenu', onContextMenu, true);
		});
	};

	rend.hooks.content.register(bindContents);

	const existing = rend.getContents();
	if (Array.isArray(existing)) {
		for (const item of existing) bindContents(item as EpubIframeContents);
	} else if (existing) {
		bindContents(existing as EpubIframeContents);
	}

	addScrollListener(window);
	addScrollListener(document);
	bindEpubScrollContainer();

	const onRendered = () => bindEpubScrollContainer();
	const onRelocated = () => {
		suppressEmitUntil = Date.now() + 350;
		hidePopBar();
		bindEpubScrollContainer();
	};
	rend.on('rendered', onRendered);
	rend.on('relocated', onRelocated);

	const onDocPointerUp = () => {
		if (!selecting) return;
		selecting = false;
		emitSelection();
	};
	document.addEventListener('pointerup', onDocPointerUp, true);
	document.addEventListener('touchend', onDocPointerUp, true);

	return () => {
		cancelAnimationFrame(rafId);
		window.clearTimeout(keyboardEmitTimer);
		document.removeEventListener('pointerup', onDocPointerUp, true);
		document.removeEventListener('touchend', onDocPointerUp, true);
		rend.off('rendered', onRendered);
		rend.off('relocated', onRelocated);
		for (const fn of scrollCleanups) fn();
		scrollCleanups.length = 0;
		for (const fn of contentCleanups.values()) fn();
		contentCleanups.clear();
		onChange(null);
	};
}

/** 根据 EPUB CFI 对应 DOM Range 计算 PopBar 锚点（点击划线/想法 mark 时用） */
export function buildEpubPopBarPayloadFromCfiRange(
	rend: Rendition,
	cfiRange: string,
	quote: string,
	resolveRange: (rend: Rendition, cfi: string) => Range | null,
): EpubSelectionPopBarPayload {
	const range = resolveRange(rend, cfiRange);
	if (range) {
		const win = range.startContainer.ownerDocument?.defaultView;
		if (win) {
			const anchor = rangeToViewportAnchor(win, range);
			if (anchor) {
				return {
					x: anchor.centerX,
					y: anchor.top,
					selectedText: quote,
					cfiRange,
				};
			}
		}
	}
	return {
		x: window.innerWidth / 2,
		y: Math.min(window.innerHeight * 0.35, 240),
		selectedText: quote,
		cfiRange,
	};
}

/** 侧栏引用块等元素上方 PopBar 锚点 */
export function buildPopBarAnchorFromElement(el: HTMLElement): {
	x: number;
	y: number;
} {
	const rect = el.getBoundingClientRect();
	return {
		x: rect.left + rect.width / 2,
		y: rect.top,
	};
}
