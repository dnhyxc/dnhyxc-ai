/** 分栏手柄拖拽期间为 true */
export const ebookSplitPanelResizingRef = { current: false };

const resizeEndListeners = new Set<() => void>();

/** 注册分栏布局稳定后的回调（返回取消订阅函数） */
export function subscribeEbookSplitPanelResizeEnd(listener: () => void) {
	resizeEndListeners.add(listener);
	return () => {
		resizeEndListeners.delete(listener);
	};
}

export function notifyEbookSplitPanelResizeEnd() {
	for (const listener of resizeEndListeners) {
		listener();
	}
}

export function beginEbookSplitPanelPointerDrag() {
	ebookSplitPanelResizingRef.current = true;
}

export function endEbookSplitPanelPointerDrag() {
	if (!ebookSplitPanelResizingRef.current) return;
	ebookSplitPanelResizingRef.current = false;
	notifyEbookSplitPanelResizeEnd();
}
