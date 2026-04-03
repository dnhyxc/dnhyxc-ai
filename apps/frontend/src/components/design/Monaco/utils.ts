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

type HeadingScrollPoint = { line: number; scrollTop: number };

/**
 * 按标题（及文首/文末）分段插值同步预览滚动：编辑器当前首可见行落在哪两个锚点之间，就在预览对应垂直区间按比例对齐。
 * 无标题或预览中尚无 `data-md-heading-line` 时回退为整篇滚动比例同步。
 */
export function syncPreviewScrollFromMarkdownEditorByHeadings(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
): void {
	const model = editor.getModel();
	if (!model) {
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}

	const lineCount = model.getLineCount();
	const visible = editor.getVisibleRanges()[0];
	const topLine = visible?.startLineNumber ?? 1;

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
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}

	const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

	const points: HeadingScrollPoint[] = [{ line: 1, scrollTop: 0 }];
	for (const { line, el } of headingEls) {
		const y = Math.min(
			maxScroll,
			Math.max(0, scrollTopToAlignElementTop(viewport, el)),
		);
		const last = points[points.length - 1];
		// 首行即标题时与文首锚点合并为同一行的预览 scrollTop
		if (last.line === line) {
			last.scrollTop = y;
			continue;
		}
		points.push({ line, scrollTop: y });
	}
	points.push({ line: lineCount, scrollTop: maxScroll });

	let i = 0;
	while (i < points.length - 1 && points[i + 1].line <= topLine) {
		i++;
	}

	const a = points[i];
	const b = points[Math.min(i + 1, points.length - 1)];
	const denom = Math.max(1, b.line - a.line);
	const t = clamp01((topLine - a.line) / denom);
	const target = a.scrollTop + t * (b.scrollTop - a.scrollTop);
	viewport.scrollTop = Math.min(maxScroll, Math.max(0, target));
}
