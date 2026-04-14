import { OnMount } from '@monaco-editor/react';

export type MonacoEditorInstance = Parameters<OnMount>[0];

export function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n));
}

/** 写入 scrollTop 时死区，减少亚像素来回写 */
const SCROLL_APPLY_DEADBAND_PX = 1.5;

/** 快照尺寸与当前布局比对容差 */
const SYNC_SNAPSHOT_LAYOUT_EPS_PX = 3;

function nearEqual(a: number, b: number, eps: number): boolean {
	return Math.abs(a - b) <= eps;
}

function applyPreviewScrollTop(viewport: HTMLElement, next: number): void {
	const cur = viewport.scrollTop;
	if (nearEqual(cur, next, SCROLL_APPLY_DEADBAND_PX)) return;
	viewport.scrollTop = next;
}

function applyEditorScrollTop(
	editor: MonacoEditorInstance,
	next: number,
): void {
	const cur = editor.getScrollTop();
	if (nearEqual(cur, next, SCROLL_APPLY_DEADBAND_PX)) return;
	editor.setScrollTop(next);
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
	applyPreviewScrollTop(viewport, clamp01(ratio) * maxScroll);
}

/** 将标题顶对齐到视口顶时所需的预览 scrollTop（考虑 scroll-margin-top） */
function scrollTopToAlignHeadingTop(
	viewport: HTMLElement,
	el: HTMLElement,
): number {
	const vr = viewport.getBoundingClientRect();
	const er = el.getBoundingClientRect();
	let scrollMarginTop = 0;
	try {
		const smt = window.getComputedStyle(el).scrollMarginTop;
		const n = Number.parseFloat(smt);
		if (Number.isFinite(n)) scrollMarginTop = n;
	} catch {
		scrollMarginTop = 0;
	}
	return viewport.scrollTop + (er.top - vr.top) - scrollMarginTop;
}

/** 分屏跟滚快照：仅在正文/布局变化时重建；滚动时只做 O(log n) 二分 + 插值 */
export type MarkdownScrollSyncSnapshot = {
	/** 分段节点：editorY 非降、previewY 非降，含文首 (0,0) 与文末 (maxEditor,maxPreview) */
	editorY: number[];
	previewY: number[];
	scrollHeight: number;
	clientHeight: number;
	lineCount: number;
	editorContentHeight: number;
	editorViewportHeight: number;
	/** 无标题时退化为整篇比例 */
	useRatioFallback: boolean;
};

function stabilizeSyncNodes(
	editorY: number[],
	previewY: number[],
	maxEditor: number,
	maxPreview: number,
): { editorY: number[]; previewY: number[] } {
	const n = editorY.length;
	if (n < 2) return { editorY, previewY };
	const e = [...editorY];
	const p = [...previewY];
	for (let k = 1; k < n; k++) {
		e[k] = Math.max(e[k], e[k - 1]);
		p[k] = Math.max(p[k], p[k - 1]);
	}
	e[0] = 0;
	p[0] = 0;
	e[n - 1] = maxEditor;
	p[n - 1] = maxPreview;
	for (let k = 1; k < n; k++) {
		if (p[k] < p[k - 1]) p[k] = p[k - 1];
		if (e[k] < e[k - 1]) e[k] = e[k - 1];
	}
	return { editorY: e, previewY: p };
}

/**
 * 在布局稳定后调用：采集标题 DOM，测量每标题在「编辑 / 预览」两侧的纵向锚点，并拼成单调分段折线。
 */
export function buildMarkdownScrollSyncSnapshot(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
): MarkdownScrollSyncSnapshot {
	const model = editor.getModel();
	const scrollHeight = viewport.scrollHeight;
	const clientHeight = viewport.clientHeight;
	const maxPreview = Math.max(0, scrollHeight - clientHeight);
	const layout = editor.getLayoutInfo();
	const maxEditor = Math.max(0, editor.getContentHeight() - layout.height);
	const lineCount = model?.getLineCount() ?? 1;
	const editorContentHeight = editor.getContentHeight();
	const editorViewportHeight = layout.height;

	if (!model) {
		return {
			editorY: [0, maxEditor],
			previewY: [0, maxPreview],
			scrollHeight,
			clientHeight,
			lineCount,
			editorContentHeight,
			editorViewportHeight,
			useRatioFallback: true,
		};
	}

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
			editorY: [0, maxEditor],
			previewY: [0, maxPreview],
			scrollHeight,
			clientHeight,
			lineCount,
			editorContentHeight,
			editorViewportHeight,
			useRatioFallback: true,
		};
	}

	const editorY: number[] = [0];
	const previewY: number[] = [0];
	let lastHeadingLine = -1;

	for (const { line, el } of headingEls) {
		const ey = Math.min(
			maxEditor,
			Math.max(0, editor.getTopForLineNumber(line)),
		);
		const py = Math.min(
			maxPreview,
			Math.max(0, scrollTopToAlignHeadingTop(viewport, el)),
		);
		if (line === lastHeadingLine) {
			editorY[editorY.length - 1] = ey;
			previewY[previewY.length - 1] = py;
			continue;
		}
		lastHeadingLine = line;
		editorY.push(ey);
		previewY.push(py);
	}

	editorY.push(maxEditor);
	previewY.push(maxPreview);

	const stable = stabilizeSyncNodes(editorY, previewY, maxEditor, maxPreview);

	return {
		editorY: stable.editorY,
		previewY: stable.previewY,
		scrollHeight,
		clientHeight,
		lineCount,
		editorContentHeight,
		editorViewportHeight,
		useRatioFallback: false,
	};
}

export function isMarkdownScrollSyncSnapshotValid(
	snap: MarkdownScrollSyncSnapshot,
	viewport: HTMLElement,
	editor: MonacoEditorInstance,
	lineCount: number,
): boolean {
	const layout = editor.getLayoutInfo();
	return (
		snap.lineCount === lineCount &&
		nearEqual(
			snap.scrollHeight,
			viewport.scrollHeight,
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		) &&
		nearEqual(
			snap.clientHeight,
			viewport.clientHeight,
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		) &&
		nearEqual(
			snap.editorContentHeight,
			editor.getContentHeight(),
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		) &&
		nearEqual(
			snap.editorViewportHeight,
			layout.height,
			SYNC_SNAPSHOT_LAYOUT_EPS_PX,
		)
	);
}

function interpolateMonotone(
	xs: number[],
	ys: number[],
	x: number,
	yMax: number,
): number {
	if (xs.length < 2) return 0;
	const clampedX = Math.min(Math.max(0, x), xs[xs.length - 1]);
	let i = 0;
	while (i < xs.length - 1 && xs[i + 1] < clampedX) {
		i++;
	}
	const xa = xs[i];
	const xb = xs[Math.min(i + 1, xs.length - 1)];
	const ya = ys[i];
	const yb = ys[Math.min(i + 1, ys.length - 1)];
	const dx = xb - xa;
	if (Math.abs(dx) < 1e-3) {
		return Math.min(yMax, Math.max(0, ya));
	}
	const t = clamp01((clampedX - xa) / dx);
	return Math.min(yMax, Math.max(0, ya + t * (yb - ya)));
}

/**
 * 新思路：不维护「行号→scroll」大表在滚动中反复失效；只用布局快照上的单调折线，
 * 用 **editor.getScrollTop()**（折行下连续）在折线上插值得到预览 scrollTop。
 */
export function syncPreviewScrollFromMarkdownEditor(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
	snapshotRef: { current: MarkdownScrollSyncSnapshot | null },
): void {
	const model = editor.getModel();
	if (!model) {
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}
	const lineCount = model.getLineCount();
	const st = editor.getScrollTop();
	const maxPreview = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

	const snap = snapshotRef.current;
	if (
		snap &&
		isMarkdownScrollSyncSnapshotValid(snap, viewport, editor, lineCount)
	) {
		if (snap.useRatioFallback) {
			setPreviewVerticalScrollRatio(
				viewport,
				editorVerticalScrollRatio(editor),
			);
			return;
		}
		const next = interpolateMonotone(
			snap.editorY,
			snap.previewY,
			st,
			maxPreview,
		);
		applyPreviewScrollTop(viewport, next);
		return;
	}

	const built = buildMarkdownScrollSyncSnapshot(editor, viewport);
	snapshotRef.current = built;
	if (built.useRatioFallback) {
		setPreviewVerticalScrollRatio(viewport, editorVerticalScrollRatio(editor));
		return;
	}
	const next = interpolateMonotone(
		built.editorY,
		built.previewY,
		st,
		maxPreview,
	);
	applyPreviewScrollTop(viewport, next);
}

/**
 * 预览驱动编辑：在同一单调折线上按 preview scrollTop 反插值得 editor scrollTop。
 */
export function syncEditorScrollFromMarkdownPreview(
	editor: MonacoEditorInstance,
	viewport: HTMLElement,
	snapshotRef: { current: MarkdownScrollSyncSnapshot | null },
): void {
	const model = editor.getModel();
	if (!model) return;

	const lineCount = model.getLineCount();
	const y = viewport.scrollTop;
	const layout = editor.getLayoutInfo();
	const maxEditor = Math.max(0, editor.getContentHeight() - layout.height);
	const maxPreview = Math.max(0, viewport.scrollHeight - viewport.clientHeight);

	const snap = snapshotRef.current;
	if (
		snap &&
		isMarkdownScrollSyncSnapshotValid(snap, viewport, editor, lineCount)
	) {
		if (snap.useRatioFallback) {
			const ratio = maxPreview <= 0 ? 0 : clamp01(y / maxPreview);
			applyEditorScrollTop(editor, ratio * maxEditor);
			return;
		}
		const next = interpolateMonotone(snap.previewY, snap.editorY, y, maxEditor);
		applyEditorScrollTop(editor, next);
		return;
	}

	const built = buildMarkdownScrollSyncSnapshot(editor, viewport);
	snapshotRef.current = built;
	if (built.useRatioFallback) {
		const ratio = maxPreview <= 0 ? 0 : clamp01(y / maxPreview);
		applyEditorScrollTop(editor, ratio * maxEditor);
		return;
	}
	const next = interpolateMonotone(built.previewY, built.editorY, y, maxEditor);
	applyEditorScrollTop(editor, next);
}

export function formatKnowledgeAutoSaveIntervalLabel(sec: number): string {
	if (sec < 60) return `${sec} 秒`;
	if (sec % 60 === 0) return `${sec / 60} 分钟`;
	return `${sec} 秒`;
}

export function normalizeMonacoEol(text: string): string {
	return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}
