import {
	type DependencyList,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
} from 'react';
import ChatCodeToolbarFloating from '@/components/design/ChatCodeToolBar';
import { ChatI18nT } from '@/types/chat';
import { layoutChatCodeToolbars } from '@/utils/chatCodeToolbar';

const emptyDeps: DependencyList = [];

/** 多实例共用同一 viewport 时避免任一子树卸载就把全局吸顶条清掉（见分享页外层 ScrollArea + Markdown 嵌入父滚动） */
let chatCodeFloatingToolbarHookMountCount = 0;

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

	// 在全局范围追踪当前活跃的 useChatCodeFloatingToolbar 实例数量。
	// 设计缘由：多实例共用同一 ScrollArea viewport 时，只有当**所有**相关组件都卸载后，才需要将悬浮工具栏全局同步置空（否则出现 Markdown 或 ScrollArea 父子嵌套时，中间某一子树卸载会导致吸顶条闪烁/消失）。
	// 详见「多实例共用」场景，如分享页外层 ScrollArea + Markdown 嵌入父滚动。
	useEffect(() => {
		// 组件挂载时，活跃实例数 +1
		chatCodeFloatingToolbarHookMountCount += 1;
		return () => {
			// 组件卸载时，活跃实例数 -1
			chatCodeFloatingToolbarHookMountCount -= 1;
			// 只有当所有相关组件都卸载后，才清除 chat code 工具栏浮层
			if (chatCodeFloatingToolbarHookMountCount <= 0) {
				// 兜底保证不小于 0，防守式写法
				chatCodeFloatingToolbarHookMountCount = 0;
				// 调用 layoutChatCodeToolbars(null) 显式清空全局浮层 DOM/状态
				layoutChatCodeToolbars(null);
			}
		};
		// 只在初次挂载、卸载时运行一次，无依赖
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
export function ChatCodeFloatingToolbar(props: { t?: ChatI18nT }) {
	return <ChatCodeToolbarFloating t={props.t} />;
}
