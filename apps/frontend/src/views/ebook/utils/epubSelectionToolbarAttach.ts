import type { Rendition } from 'epubjs';
import {
	extractQuoteSegmentsFromRange,
	type QuoteShareRun,
} from './epubQuoteShareStyled';
import {
	getAccurateRangeLineClientRects,
	normalizeSelectionRangeForEpub,
	resolveSelectionCfiRange,
} from './epubRangeGeometry';
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
	/** 保留原文字号/字重的样式片段 */
	quoteSegments?: QuoteShareRun[];
	cfiRange?: string;
};

/** 划线/想法 mark 点击打开 PopBar 后，避免选区监听误关 */
let suppressDismissUntil = 0;

/**
 * 抑制 EPUB 选区工具栏（PopBar）自动消失一段时间。
 *
 * 常用于划线后点击 mark 按钮时，避免短时间内由于选区监听导致工具栏被误关闭。
 *
 * @param ms 抑制时长（毫秒），默认为 450ms，足够用户操作弹窗内的按钮。
 *
 * 该函数通过将 suppressDismissUntil 设为当前时间 + ms，
 * 其他逻辑可通过 shouldSuppressDismiss() 判断是否需要临时关闭自动隐藏行为。
 */
export function suppressEpubSelectionPopBarDismiss(ms = 450): void {
	suppressDismissUntil = Date.now() + ms;
}

/**
 * 判断是否应临时抑制 EPUB 选区工具栏（PopBar）自动消失。
 *
 * suppressEpubSelectionPopBarDismiss 会设置 suppressDismissUntil 为“当前时间 + 指定毫秒数”，
 * 该函数判断当前是否还在抑制期内。常用于点击划线/标记等操作后，
 * 在弹窗按钮短时间交互过程中，避免工具栏被误自动关闭。
 *
 * @returns 若当前处于抑制期内，返回 true，否则返回 false。
 */
function shouldSuppressDismiss(): boolean {
	// 只要 suppressDismissUntil 还未到期，就应暂不自动关闭
	return Date.now() < suppressDismissUntil;
}

/**
 * 读取指定窗口当前选中的文本内容。
 *
 * 会自动调用 getSelection，并提取选区内文本，如果当前没有选区则返回空字符串。
 * 最终返回会自动修剪首尾空白字符。
 *
 * @param win 目标 window（通常为 iframe 内文档的 window）
 * @returns 当前选区的文本内容（已去首尾空白），若无选中则为 ''
 */
function readSelectionText(win: Window): string {
	// 调用 window.getSelection() 获取当前选区，提取文本并修剪
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
	const normalized = normalizeSelectionRangeForEpub(range) ?? range;
	const visibleRects = getAccurateRangeLineClientRects(normalized);

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
		const normalized = normalizeSelectionRangeForEpub(range);
		if (!normalized) continue;
		return { win, text, range: normalized };
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
	/** 右键菜单手势：mouseup 早于 contextmenu，须跳过 emit 避免 PopBar 闪一下再关 */
	let contextMenuGesture = false;

	const clearPendingEmit = () => {
		cancelAnimationFrame(rafId);
		rafId = 0;
		window.clearTimeout(keyboardEmitTimer);
		keyboardEmitTimer = 0;
	};

	const hidePopBar = () => {
		if (shouldSuppressDismiss()) return;
		clearPendingEmit();
		onChange(null);
	};

	/** 右键菜单等场景：必须关 PopBar，不受 suppressDismiss 影响 */
	const forceHidePopBar = () => {
		clearPendingEmit();
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
				// 抛出当前激活选区信息，供外部响应（如展示 PopBar 工具栏等）
				onChange({
					// PopBar 横向居中显示的坐标（选区矩形中心 X 坐标）
					x: anchor.centerX,
					// PopBar 纵向基准点（选区矩形顶端 Y 坐标）
					y: anchor.top,
					// 选中的纯文本内容
					selectedText: active.text,
					// 选区中的富文本片段（含原 DOM 字号、样式等，供生成高保真分享卡片用）
					quoteSegments: extractQuoteSegmentsFromRange(
						active.range,
						active.win,
					),
					// 选区对应的 EPUB CFI 范围，便于定位和后续引用
					cfiRange: resolveSelectionCfiRange(rend, active.win, active.range),
				});
			});
		});
	};

	/**
	 * 监听并处理 epub iframe 内部 selection 相关事件，确保 PopBar 出现/消失逻辑准确
	 * @param contents - 当前 EPUB 渲染页的 iframe contents 对象
	 */
	const bindContents = (contents: EpubIframeContents) => {
		// 若当前 contents 已经绑定过事件，则跳过，防止重复注册
		if (contentCleanups.has(contents)) return;
		const doc = contents.document;

		/**
		 * 指针按下事件：用于标记用户正在进行拖选或其他操作，提前隐藏 PopBar，避免误触
		 * - 鼠标右键时（button === 2），标记为 contextMenuGesture，抑制短时间内 PopBar 显示
		 * - 设置 suppressEmitUntil，给出 600ms 抑制窗口（避免右键呼出菜单引发不必要的 selection 反馈）
		 * - selecting=true 用于追踪当前是否有拖选操作
		 */
		const onPointerDown = (e: Event) => {
			if (e instanceof MouseEvent && e.button === 2) {
				// 右键点击，进入 context menu 手势状态
				contextMenuGesture = true;
				// 短暂抑制 emitSelection，避免右键菜单期间出 PopBar
				suppressEmitUntil = Date.now() + 600;
			}
			selecting = true; // 标记为正在拖选
			hidePopBar(); // 立即隐藏 PopBar
		};

		/**
		 * 指针松开事件：结束拖选流程
		 * - 只有在 selecting 标记为 true 时才响应（即必须是之前 pointerDown 开始的拖选）
		 * - 若处于 contextMenuGesture（右键菜单）状态或本次是右键松开，则忽略（避免误触发 PopBar）
		 * - 正常松开则触发 emitSelection，让选区工具栏弹出
		 */
		const onPointerUp = (e: Event) => {
			if (!selecting) return; // 并非拖选流程，无需处理
			selecting = false; // 重置 selecting 状态
			if (
				contextMenuGesture || // 处于 context menu 手势状态
				(e instanceof MouseEvent && e.button === 2) // 或本次是右键松开
			) {
				return; // 此类操作不触发 PopBar
			}
			emitSelection(); // 拖选结束后，根据当前选区展示 PopBar
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

		const onContextMenu = () => {
			contextMenuGesture = false;
			suppressEmitUntil = Date.now() + 600;
			forceHidePopBar();
		};

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
					quoteSegments: extractQuoteSegmentsFromRange(range, win),
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
