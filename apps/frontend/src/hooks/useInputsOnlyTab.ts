import { useLayoutEffect } from 'react';

/** 可能进入 Tab 序的非表单控件（不含 input/textarea/select 本身；不含 iframe，避免抢插件焦点） */
const NON_FIELD_FOCUSABLE =
	'button, a[href], area[href], object, embed, summary, [tabindex]:not([tabindex="-1"])';

function applyInputsOnlyTab(root: ParentNode) {
	for (const el of root.querySelectorAll<HTMLElement>(NON_FIELD_FOCUSABLE)) {
		if (el.matches('input, textarea, select')) continue;
		// Radix Dialog/Sheet 焦点陷阱依赖 tabbable；强行 -1 会与 FocusScope 互殴卡死主线程
		if (el.closest('[role="dialog"], [data-radix-focus-guard]')) continue;
		el.tabIndex = -1;
	}
}

/**
 * 全站 Tab 顺序：仅 input / textarea / select 可聚焦；按钮与链接仍可用鼠标或表单 Enter。
 * 监听 document.body，含 Portal 弹层；MutationObserver 合并 rAF 以减轻高频 DOM 更新。
 */
export function useInputsOnlyTab() {
	useLayoutEffect(() => {
		const root = document.body;
		let raf = 0;
		const scheduleApply = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => applyInputsOnlyTab(root));
		};

		scheduleApply();
		const observer = new MutationObserver(scheduleApply);
		observer.observe(root, { childList: true, subtree: true });
		return () => {
			cancelAnimationFrame(raf);
			observer.disconnect();
		};
	}, []);
}
