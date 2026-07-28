import {
	type DependencyList,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
} from 'react';
import ChatCodeToolbarFloating from '@/components/design/ChatCodeToolBar';
import { ChatI18nT } from '@/types/chat';
import {
	invalidateChatCodeFenceBlockCache,
	layoutChatCodeToolbars,
} from '@/utils/chatCodeToolbar';

const emptyDeps: DependencyList = [];

/** 多实例共用同一 viewport 时避免任一子树卸载就把全局吸顶条清掉（见分享页外层 ScrollArea + Markdown 嵌入父滚动） */
let chatCodeFloatingToolbarHookMountCount = 0;

export type UseChatCodeFloatingToolbarOptions = {
	/**
	 * 为 false 时不挂监听、不测 layout（预览+助手等同屏争用场景关闭吸顶条）。
	 * 默认 true。
	 */
	enabled?: boolean;
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
 * 滚动热路径不 refresh 块列表；正文变化（layoutDeps）才 invalidate + refresh。
 */
export function useChatCodeFloatingToolbar(
	viewportRef: RefObject<HTMLElement | null>,
	options?: UseChatCodeFloatingToolbarOptions,
): { relayout: () => void } {
	const enabled = options?.enabled ?? true;
	const layoutDeps = options?.layoutDeps ?? emptyDeps;
	const passiveScrollDeps = options?.passiveScrollDeps ?? emptyDeps;
	const passiveScrollLayout = options?.passiveScrollLayout ?? false;
	const scrollLayoutRafRef = useRef(0);

	const relayoutAfterContent = useCallback(() => {
		if (!enabled) return;
		const vp = viewportRef.current;
		invalidateChatCodeFenceBlockCache(vp);
		layoutChatCodeToolbars(vp, { refreshBlocks: true });
	}, [viewportRef, enabled]);

	/** scroll 热路径合并到单帧；复用块列表缓存，勿 refreshBlocks */
	const relayoutOnScroll = useCallback(() => {
		if (!enabled) return;
		if (scrollLayoutRafRef.current) return;
		scrollLayoutRafRef.current = requestAnimationFrame(() => {
			scrollLayoutRafRef.current = 0;
			layoutChatCodeToolbars(viewportRef.current);
		});
	}, [viewportRef, enabled]);

	useEffect(() => {
		return () => {
			if (scrollLayoutRafRef.current) {
				cancelAnimationFrame(scrollLayoutRafRef.current);
				scrollLayoutRafRef.current = 0;
			}
		};
	}, []);

	useEffect(() => {
		if (!enabled) return;
		chatCodeFloatingToolbarHookMountCount += 1;
		return () => {
			chatCodeFloatingToolbarHookMountCount -= 1;
			if (chatCodeFloatingToolbarHookMountCount <= 0) {
				chatCodeFloatingToolbarHookMountCount = 0;
				layoutChatCodeToolbars(null);
			}
		};
	}, [enabled]);

	useEffect(() => {
		if (!enabled) return;
		const onResize = () => layoutChatCodeToolbars(viewportRef.current);
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, [enabled, viewportRef]);

	useEffect(() => {
		if (!enabled) return;
		let ro: ResizeObserver | null = null;
		let cancelled = false;
		let raf = 0;

		const attach = () => {
			const el = viewportRef.current;
			if (!el || cancelled) return false;
			ro?.disconnect();
			ro = new ResizeObserver(() =>
				layoutChatCodeToolbars(viewportRef.current),
			);
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, relayoutAfterContent, ...layoutDeps]);

	useEffect(() => {
		if (!enabled) return;
		relayoutAfterContent();
		const id = requestAnimationFrame(() => relayoutAfterContent());
		return () => cancelAnimationFrame(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps -- layoutDeps 由调用方传入
	}, [enabled, relayoutAfterContent, ...layoutDeps]);

	useLayoutEffect(() => {
		if (!enabled) return;
		const el = viewportRef.current;
		if (!el) return;
		invalidateChatCodeFenceBlockCache(el);
		layoutChatCodeToolbars(el, { refreshBlocks: true });
		const id = requestAnimationFrame(() =>
			layoutChatCodeToolbars(el, { refreshBlocks: true }),
		);
		return () => cancelAnimationFrame(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled, relayoutAfterContent, ...layoutDeps]);

	useLayoutEffect(() => {
		if (!enabled || !passiveScrollLayout) return;
		const vp = viewportRef.current;
		if (!vp) return;
		const onScroll = () => relayoutOnScroll();
		vp.addEventListener('scroll', onScroll, { passive: true });
		return () => vp.removeEventListener('scroll', onScroll);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		enabled,
		passiveScrollLayout,
		viewportRef,
		relayoutOnScroll,
		...passiveScrollDeps,
	]);

	return { relayout: relayoutOnScroll };
}

/**
 * 与 `useChatCodeFloatingToolbar` 配套：挂在滚动容器**同级**（祖先含 `position: relative` 即可），
 * Portal 到 `document.body` 渲染吸顶代码栏。
 */
export function ChatCodeFloatingToolbar(props: { t?: ChatI18nT }) {
	return <ChatCodeToolbarFloating t={props.t} />;
}
