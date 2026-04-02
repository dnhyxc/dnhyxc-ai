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
	viewport: HTMLDivElement,
	ratio: number,
): void {
	const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
	viewport.scrollTop = clamp01(ratio) * maxScroll;
}
