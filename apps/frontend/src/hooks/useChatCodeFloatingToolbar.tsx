import {
	type DependencyList,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
} from 'react';
import ChatCodeToolbarFloating from '@/components/design/ChatCodeToolBar';
import { layoutChatCodeToolbars } from '@/utils/chatCodeToolbar';

const emptyDeps: DependencyList = [];

export type UseChatCodeFloatingToolbarOptions = {
	/**
	 * Markdown / 消息等变化后补算吸顶条（`requestAnimationFrame` + `useLayoutEffect`）。
	 * 请传入稳定依赖（如 `[chatData]`、`[markdown]`），勿每次 render 新建数组。
	 */
	layoutDeps?: DependencyList;
	/**
	 * 为 true 时在滚动视口上额外挂 **passive** 的 `scroll` 监听，仅调用 `layoutChatCodeToolbars`。
	 * 与 React `onScroll` 互补（部分环境下需双通道才能保证跟手）；ChatBotView 等场景开启。
	 */
	passiveScrollLayout?: boolean;
	/** `passiveScrollLayout` 为 true 时，用于在会话切换等场景重绑 scroll 监听 */
	passiveScrollDeps?: DependencyList;
};

/**
 * 将「代码块浮动工具栏」与某一 **滚动 viewport**（通常为 ScrollArea 落在 DOM 上的 ref）绑定：
 * - `window` resize
 * - viewport `ResizeObserver`
 * - `layoutDeps` 变化时的双帧布局
 * - 可选：passive scroll 补帧
 *
 * 返回的 `relayout` 可在业务自己的 `onScroll` / `syncScrollMetrics` 中再调一次（幂等）。
 */
export function useChatCodeFloatingToolbar(
	viewportRef: RefObject<HTMLElement | null>,
	options?: UseChatCodeFloatingToolbarOptions,
): { relayout: () => void } {
	const layoutDeps = options?.layoutDeps ?? emptyDeps;
	const passiveScrollDeps = options?.passiveScrollDeps ?? emptyDeps;
	const passiveScrollLayout = options?.passiveScrollLayout ?? false;

	const relayout = useCallback(() => {
		layoutChatCodeToolbars(viewportRef.current);
	}, [viewportRef]);

	useEffect(() => {
		return () => {
			layoutChatCodeToolbars(null);
		};
	}, []);

	useEffect(() => {
		const onResize = () => layoutChatCodeToolbars(viewportRef.current);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	useEffect(() => {
		let ro: ResizeObserver | null = null;
		let cancelled = false;
		let raf = 0;

		const attach = () => {
			const el = viewportRef.current;
			if (!el || cancelled) return false;
			ro?.disconnect();
			ro = new ResizeObserver(() => relayout());
			ro.observe(el);
			return true;
		};

		if (!attach()) {
			let attempts = 0;
			const retry = () => {
				if (cancelled || attempts++ > 90) return;
				if (!attach()) raf = requestAnimationFrame(retry);
			};
			raf = requestAnimationFrame(retry);
		}

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf);
			ro?.disconnect();
		};
		// 与 layoutDeps 同步：首帧 ref 常为空，内容挂载后需重新 observe
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [relayout, ...layoutDeps]);

	useEffect(() => {
		relayout();
		const id = requestAnimationFrame(() => relayout());
		return () => cancelAnimationFrame(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- layoutDeps 由调用方传入
	}, [relayout, ...layoutDeps]);

	useLayoutEffect(() => {
		const el = viewportRef.current;
		if (!el) return;
		layoutChatCodeToolbars(el);
		const id = requestAnimationFrame(() => layoutChatCodeToolbars(el));
		return () => cancelAnimationFrame(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [relayout, ...layoutDeps]);

	useLayoutEffect(() => {
		if (!passiveScrollLayout) return;
		const vp = viewportRef.current;
		if (!vp) return;
		const onScroll = () => layoutChatCodeToolbars(vp);
		vp.addEventListener('scroll', onScroll, { passive: true });
		return () => vp.removeEventListener('scroll', onScroll);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [passiveScrollLayout, viewportRef, ...passiveScrollDeps]);

	return { relayout };
}

/**
 * 与 `useChatCodeFloatingToolbar` 配套：挂在滚动容器**同级**（祖先含 `position: relative` 即可），
 * Portal 到 `document.body` 渲染吸顶代码栏。
 */
export function ChatCodeFloatingToolbar() {
	return <ChatCodeToolbarFloating />;
}
