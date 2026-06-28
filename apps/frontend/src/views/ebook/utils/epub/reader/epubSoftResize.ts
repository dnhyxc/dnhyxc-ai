import type { Rendition } from 'epubjs';

type EpubViewManager = {
	stage?: {
		size: (
			width?: number | null,
			height?: number | null,
		) => { width: number; height: number };
	};
	_stageSize?: { width: number; height: number };
	updateLayout: () => void;
};

/**
 * 在不 clear 已有 view 的前提下更新 EPUB 排版。
 * rendition.resize() 会清空视图并重载章节，连续调用会白屏；拖拽分栏应优先走此路径。
 */
export function softResizeEpubRendition(
	rend: Rendition,
	width: number,
	height: number,
): boolean {
	const manager = (rend as unknown as { manager?: EpubViewManager }).manager;
	if (!manager?.stage?.size || typeof manager.updateLayout !== 'function') {
		return false;
	}

	const w = Math.max(Math.floor(width), 1);
	const h = Math.max(Math.floor(height), 1);
	const prev = manager._stageSize;
	if (prev && prev.width === w && prev.height === h) {
		return true;
	}

	try {
		const rendition = rend as unknown as {
			settings: { width?: number; height?: number };
		};
		rendition.settings.width = w;
		rendition.settings.height = h;
		manager.stage.size(w, h);
		manager.updateLayout();
		return true;
	} catch {
		return false;
	}
}
