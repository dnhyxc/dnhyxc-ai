import { OnMount } from '@monaco-editor/react';

export type MonacoEditorInstance = Parameters<OnMount>[0];

export function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n));
}

/** 编辑器垂直滚动位置归一化到 [0,1]（顶到底） */
export function editorVerticalScrollRatio(
	editor: MonacoEditorInstance,
): number {
	const layout = editor.getLayoutInfo();
	const contentHeight = editor.getContentHeight();
	const maxScroll = Math.max(0, contentHeight - layout.height);
	if (maxScroll <= 0) return 0;
	return clamp01(editor.getScrollTop() / maxScroll);
}

export function setPreviewVerticalScrollRatio(
	viewport: HTMLElement,
	ratio: number,
): void {
	const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
	viewport.scrollTop = clamp01(ratio) * maxScroll;
}

/** 将元素顶部对齐到滚动视口顶部时所需的 scrollTop（与当前 scrollTop 无关） */
function scrollTopToAlignElementTop(
	viewport: HTMLElement,
	el: HTMLElement,
): number {
	const vr = viewport.getBoundingClientRect();
	const er = el.getBoundingClientRect();
	return viewport.scrollTop + (er.top - vr.top);
}

export type HeadingScrollPoint = { line: number; scrollTop: number };

/**
 * 跟随滚动缓存：在正文/视口尺寸未变时，滚动回调里只做插值 + 写 scrollTop，避免每帧 querySelector 与批量 getBoundingClientRect。
 */
export type HeadingScrollCache = {
	points: HeadingScrollPoint[];
	scrollHeight: number;
	clientHeight: number;
	lineCount: number;
	/** 无标题等场景下始终用整篇比例同步 */
	useRatioFallback: boolean;
};

function interpolatePreviewScrollTop(
	points: HeadingScrollPoint[],
	topLine: number,
	maxScroll: number,
): number {
	let i = 0;
	while (i < points.length - 1 && points[i + 1].line <= topLine) {
		i++;
	}
	const a = points[i];
	const b = points[Math.min(i + 1, points.length - 1)];
	const denom = Math.max(1, b.line - a.line);
	const t = clamp01((topLine - a.line) / denom);
	return Math.min(
		maxScroll,
		Math.max(0, a.scrollTop + t * (b.scrollTop - a.scrollTop)),
	);
}

/** 预览 scrollTop → 对应编辑器首可见行（与 interpolatePreviewScrollTop 互逆，按同一段锚点插值） */
function interpolateLineFromPreviewScroll(
	points: HeadingScrollPoint[],
	previewScrollTop: number,
	maxScroll: number,
	lineCount: number,
): number {
	const y = Math.min(maxScroll, Math.max(0, previewScrollTop));
	if (points.length < 2) {
		return 1;
	}
	let i = 0;
	while (i < points.length - 1 && points[i + 1].scrollTop < y) {
		i++;
	}
	const a = points[i];
	const b = points[Math.min(i + 1, points.length - 1)];
	const ds = b.scrollTop - a.scrollTop;
	if (Math.abs(ds) < 1e-6) {
		return Math.min(lineCount, Math.max(1, a.line));
	}
	const t = clamp01((y - a.scrollTop) / ds);
	const line = a.line + t * (b.line - a.line);
	return Math.min(lineCount, Math.max(1, line));
}

export function isHeadingScrollCacheValid(
	cache: HeadingScrollCache,
	viewport: HTMLElement,
	lineCount: number,
): boolean {
	return (
		cache.lineCount === lineCount &&
		cache.scrollHeight === viewport.scrollHeight &&
		cache.clientHeight === viewport.clientHeight
	);
}

/**
 * 测量预览 DOM，构建标题锚点缓存（在 layout 后或 ResizeObserver 中调用，勿放在每帧滚动里）。
 */
export function buildHeadingScrollCache(
	viewport: HTMLElement,
	lineCount: number,
): HeadingScrollCache {
	const scrollHeight = viewport.scrollHeight;
	const clientHeight = viewport.clientHeight;
	const maxScroll = Math.max(0, scrollHeight - clientHeight);

	const headingEls = [
		...viewport.querySelectorAll<HTMLElement>('[data-md-heading-line]'),
	]
		.map((el) => {
			const raw = el.getAttribute('data-md-heading-line');
			const line = raw ? Number.parseInt(raw, 10) : NaN;
			return Number.isFinite(line) ? { line, el } : null;
		})
		.filter((x): x is { line: number; el: HTMLElement } => x !== null)
		.sort((a, b) => a.line - b.line);

	if (headingEls.length === 0) {
		return {
			points: [],
			scrollHeight,
			clientHeight,
			lineCount,
			useRatioFallback: true,
		};
	}

	const points: HeadingScrollPoint[] = [{ line: 1, scrollTop: 0 }];
	for (const { line, el } of headingEls) {
		const y = Math.min(
			maxScroll,
			Math.max(0, scrollTopToAlignElementTop(viewport, el)),
		);
		const last = points[points.length - 1];
		if (last.line === line) {
			last.scrollTop = y;
			continue;
		}
		points.push({ line, scrollTop: y });
	}
	points.push({ line: lineCount, scrollTop: maxScroll });

	return {
		points,
		scrollHeight,
		clientHeight,
		lineCount,
		useRatioFallback: false,
	};
}

/**
 * 按标题（及文首/文末）分段插值同步预览滚动。
 * 传入 **`cacheRef`** 且缓存与当前视口/行数一致时走热路径（无 DOM 枚举）；否则全量测量并写回缓存。
 */
export function syncPreviewScrollFromMarkdownEditorByHeadings(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
	cacheRef?: { current: HeadingScrollCache | null },
): void {
	const model = editor.getModel();
	if (!model) {
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}

	const lineCount = model.getLineCount();
	const visible = editor.getVisibleRanges()[0];
	const topLine = visible?.startLineNumber ?? 1;
	const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

	const cache = cacheRef?.current;
	if (cache && isHeadingScrollCacheValid(cache, viewport, lineCount)) {
		if (cache.useRatioFallback) {
			setPreviewVerticalScrollRatio(
				viewport,
				editorVerticalScrollRatio(editor),
			);
			return;
		}
		viewport.scrollTop = interpolatePreviewScrollTop(
			cache.points,
			topLine,
			maxScroll,
		);
		return;
	}

	// 冷路径：全量测量并刷新缓存
	const built = buildHeadingScrollCache(viewport, lineCount);
	if (cacheRef) {
		cacheRef.current = built;
	}

	if (built.useRatioFallback) {
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}

	viewport.scrollTop = interpolatePreviewScrollTop(
		built.points,
		topLine,
		maxScroll,
	);
}

/**
 * 按标题锚点反推：根据预览 `scrollTop` 将编辑器滚到对应首行（与 syncPreviewScrollFromMarkdownEditorByHeadings 对偶）。
 */
export function syncEditorScrollFromPreviewByHeadings(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
	cacheRef?: { current: HeadingScrollCache | null },
): void {
	const model = editor.getModel();
	if (!model) {
		return;
	}

	const lineCount = model.getLineCount();
	const maxPreview = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
	const y = viewport.scrollTop;

	const layout = editor.getLayoutInfo();
	const contentHeight = editor.getContentHeight();
	const maxEditor = Math.max(0, contentHeight - layout.height);

	const cache = cacheRef?.current;
	if (cache && isHeadingScrollCacheValid(cache, viewport, lineCount)) {
		if (cache.useRatioFallback) {
			const ratio = maxPreview <= 0 ? 0 : clamp01(y / maxPreview);
			editor.setScrollTop(ratio * maxEditor);
			return;
		}
		const lineF = interpolateLineFromPreviewScroll(
			cache.points,
			y,
			maxPreview,
			lineCount,
		);
		const ln = Math.round(lineF);
		editor.revealLineNearTop(ln);
		return;
	}

	const built = buildHeadingScrollCache(viewport, lineCount);
	if (cacheRef) {
		cacheRef.current = built;
	}

	if (built.useRatioFallback) {
		const ratio = maxPreview <= 0 ? 0 : clamp01(y / maxPreview);
		editor.setScrollTop(ratio * maxEditor);
		return;
	}

	const lineF = interpolateLineFromPreviewScroll(
		built.points,
		y,
		maxPreview,
		lineCount,
	);
	editor.revealLineNearTop(Math.round(lineF));
}
