import {
	type RefObject,
	type UIEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	buildStreamTick,
	type ScrollFabMode,
} from '@/components/design/Assistant';
import { useChatCodeFloatingToolbar } from '@/hooks/useChatCodeFloatingToolbar';
import {
	type StickToBottomScrollViewportHandlers,
	useStickToBottomScroll,
} from '@/hooks/useStickToBottomScroll';
import type { Message } from '@/types/chat';

export type UseAssistantScrollOptions = {
	/** 流式贴底 revision；与 `messageCount` 联用时可不传 `messages` */
	contentRevision?: string;
	messageCount?: number;
	messages?: readonly Message[];
	isStreaming: boolean;
	/** 切换文档/会话时重置贴底 */
	resetKey?: string | null;
	/** 非流式历史就绪后补滚 */
	idleFlushKey?: string | null;
	codeToolbarLayoutDeps?: readonly unknown[];
	scrollBehavior?: ScrollBehavior;
};

export type UseAssistantScrollResult = {
	viewportRef: RefObject<HTMLDivElement | null>;
	scrollAreaHandlers: StickToBottomScrollViewportHandlers;
	enableStickToBottom: () => void;
	disableStickToBottom: () => void;
	flushScrollToBottom: (options?: { force?: boolean }) => void;
	streamTick: string;
	scrollFabMode: ScrollFabMode;
	onScrollFabClick: () => void;
};

/** 助手滚动：流式贴底 + 代码块工具栏 + 置顶/置底 FAB */
export function useAssistantScroll({
	contentRevision: contentRevisionProp,
	messageCount: messageCountProp,
	messages,
	isStreaming,
	resetKey,
	idleFlushKey,
	codeToolbarLayoutDeps = [],
	scrollBehavior = 'smooth',
}: UseAssistantScrollOptions): UseAssistantScrollResult {
	const streamTick =
		contentRevisionProp ??
		(messages ? buildStreamTick(messages) : String(messageCountProp ?? 0));
	const messageCount = messageCountProp ?? messages?.length ?? 0;

	const {
		viewportRef,
		scrollViewportHandlers,
		enableStickToBottom,
		disableStickToBottom,
		flushScrollToBottom,
	} = useStickToBottomScroll({
		isStreaming,
		contentRevision: streamTick,
		resetKey: resetKey ?? undefined,
		idleFlushKey,
	});

	const [scrollFabMode, setScrollFabMode] = useState<ScrollFabMode>('hidden');
	const scrollFabModeRef = useRef<ScrollFabMode>('hidden');

	const updateScrollFab = useCallback(() => {
		const vp = viewportRef.current;
		if (!vp) return;
		const { scrollTop, scrollHeight, clientHeight } = vp;
		const maxScroll = scrollHeight - clientHeight;
		let next: ScrollFabMode = 'hidden';
		if (maxScroll > 4) {
			next = scrollTop >= maxScroll - 8 ? 'toTop' : 'toBottom';
		}
		if (scrollFabModeRef.current !== next) {
			scrollFabModeRef.current = next;
			setScrollFabMode(next);
		}
	}, [viewportRef]);

	const { relayout: relayoutCodeToolbar } = useChatCodeFloatingToolbar(
		viewportRef as RefObject<HTMLElement | null>,
		{
			layoutDeps: [streamTick, messageCount, ...codeToolbarLayoutDeps],
			passiveScrollLayout: true,
			passiveScrollDeps: [
				messageCount,
				streamTick,
				isStreaming,
				...codeToolbarLayoutDeps,
			],
		},
	);

	const scrollAreaHandlers = useMemo(() => {
		const { onScroll: onViewportScroll, ...rest } = scrollViewportHandlers;
		return {
			...rest,
			onScroll: (e: UIEvent<HTMLDivElement>) => {
				onViewportScroll(e);
				relayoutCodeToolbar();
				updateScrollFab();
			},
		};
	}, [scrollViewportHandlers, relayoutCodeToolbar, updateScrollFab]);

	useEffect(() => {
		if (messageCount === 0) {
			scrollFabModeRef.current = 'hidden';
			setScrollFabMode('hidden');
		}
	}, [messageCount]);

	useEffect(() => {
		let ro: ResizeObserver | null = null;
		const tid = window.setTimeout(() => {
			updateScrollFab();
			requestAnimationFrame(() => updateScrollFab());
			const vp = viewportRef.current;
			if (vp) {
				ro = new ResizeObserver(() => updateScrollFab());
				ro.observe(vp);
			}
		}, 0);
		return () => {
			window.clearTimeout(tid);
			ro?.disconnect();
		};
	}, [streamTick, messageCount, updateScrollFab, viewportRef]);

	const onScrollFabClick = useCallback(() => {
		const vp = viewportRef.current;
		if (!vp) return;
		if (scrollFabMode === 'toBottom') {
			enableStickToBottom();
			vp.scrollTo({
				top: vp.scrollHeight - vp.clientHeight,
				behavior: scrollBehavior,
			});
		} else if (scrollFabMode === 'toTop') {
			disableStickToBottom();
			vp.scrollTo({ top: 0, behavior: scrollBehavior });
		}
	}, [
		viewportRef,
		enableStickToBottom,
		disableStickToBottom,
		scrollFabMode,
		scrollBehavior,
	]);

	return {
		viewportRef,
		scrollAreaHandlers,
		enableStickToBottom,
		disableStickToBottom,
		flushScrollToBottom,
		streamTick,
		scrollFabMode,
		onScrollFabClick,
	};
}
