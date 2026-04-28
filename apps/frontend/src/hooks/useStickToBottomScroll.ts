import {
	type PointerEventHandler,
	type RefObject,
	type UIEventHandler,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	type WheelEventHandler,
} from 'react';

/** 默认：距底 ≤ 该值视为「在底部」，非流式下恢复跟滚；流式下须配合下滚才恢复 */
export const DEFAULT_STICK_RESUME_BOTTOM_PX = 48;
/** 默认：距底 ≥ 该值时，非流式下解除跟滚 */
export const DEFAULT_STICK_RELEASE_BOTTOM_PX = 120;

export interface UseStickToBottomScrollOptions {
	/**
	 * 是否处于「流式」模式（streaming，流式输出）：
	 * 影响 resume/解除策略，以及 wheel / pointer 是否打断跟底。
	 */
	isStreaming: boolean;
	/**
	 * 内容版本戳（任意可序列化比较的值）：
	 * 变化时在「跟底开启」下将视口滚到物理底部（如同步 `scrollHeight` 增长）。
	 */
	contentRevision: unknown;
	/**
	 * 切换会话、路由、文档等时传入：
	 * 变化后恢复为跟底，并清空内部 `scrollTop` 观测，避免沿用上一容器滚动状态。
	 */
	resetKey?: string | number | boolean | null;
	/** 距底 ≤ 该像素视为底部带（默认 48） */
	resumeWithinBottomPx?: number;
	/** 非流式下距底 ≥ 该像素视为已离开底部（默认 120） */
	releaseBeyondBottomPx?: number;
	/** 流式时滚轮向上（deltaY 为负）是否解除跟底，默认 true */
	interruptOnWheelUpWhileStreaming?: boolean;
	/** 流式时指针在视口按下是否解除跟底，默认 true */
	interruptOnPointerDownWhileStreaming?: boolean;
	/**
	 * 非流式（idle）就绪贴底：与 `isStreaming` + `contentRevision` 的贴底互补。
	 * - 未传（`undefined`）：不启用该逻辑。
	 * - `null` 或空串：清除「已贴底」记忆，不就绪时不滚（例如加载中、无列表）。
	 * - 非空串且与上次不同：恢复跟底并在一帧内多次 `flush`（含 `setTimeout(0)`，覆盖 MdPreview/图片晚一拍撑高）。
	 */
	idleFlushKey?: string | null;
}

export interface StickToBottomScrollViewportHandlers {
	onScroll: UIEventHandler<HTMLDivElement>;
	onWheelCapture: WheelEventHandler<HTMLDivElement>;
	onPointerDownCapture: PointerEventHandler<HTMLDivElement>;
}

export interface UseStickToBottomScrollResult {
	/** 挂到 Radix ScrollArea Viewport 等可滚动容器（与现有 `ScrollArea` ref 一致） */
	viewportRef: RefObject<HTMLDivElement | null>;
	/** 展开到视口组件：`{ ...scrollViewportHandlers }` */
	scrollViewportHandlers: StickToBottomScrollViewportHandlers;
	/** 恢复自动贴底（如新消息、人工希望继续跟滚） */
	enableStickToBottom: () => void;
	/** 取消自动贴底 */
	disableStickToBottom: () => void;
	/** 单次滚到物理底部，不修改是否跟底的内部状态 */
	flushScrollToBottom: () => void;
}

/**
 * 可滚动容器「内容增长时自动贴底 + 用户上滑/滚轮打断」的通用逻辑，
 * 适用于聊天、日志、SSE 文本区等；与 Radix `ScrollArea` 的 Viewport ref 配合使用。
 *
 * 流式贴底由 `isStreaming` + `contentRevision` 驱动；历史加载完成、切换会话等非流式场景可传 `idleFlushKey` 补滚。
 */
export function useStickToBottomScroll(
	options: UseStickToBottomScrollOptions,
): UseStickToBottomScrollResult {
	const {
		isStreaming,
		contentRevision,
		resetKey,
		resumeWithinBottomPx = DEFAULT_STICK_RESUME_BOTTOM_PX,
		releaseBeyondBottomPx = DEFAULT_STICK_RELEASE_BOTTOM_PX,
		interruptOnWheelUpWhileStreaming = true,
		interruptOnPointerDownWhileStreaming = true,
		idleFlushKey: idleFlushKeyProp,
	} = options;

	const viewportRef = useRef<HTMLDivElement>(null);
	const stickToBottomRef = useRef(true);
	const suppressStickFromViewportScrollRef = useRef(false);
	const lastViewportScrollTopRef = useRef<number | null>(null);
	const idleFlushAppliedKeyRef = useRef<string | null>(null);

	useEffect(() => {
		if (resetKey === undefined || resetKey === null) return;
		if (typeof resetKey === 'string' && resetKey === '') return;
		stickToBottomRef.current = true;
		lastViewportScrollTopRef.current = null;
	}, [resetKey]);

	const flushScrollToBottom = useCallback(() => {
		const vp = viewportRef.current;
		if (!vp) return;
		vp.scrollTop = vp.scrollHeight;
	}, []);

	const enableStickToBottom = useCallback(() => {
		stickToBottomRef.current = true;
	}, []);

	const disableStickToBottom = useCallback(() => {
		stickToBottomRef.current = false;
	}, []);

	const onScroll = useCallback<UIEventHandler<HTMLDivElement>>(() => {
		const vp = viewportRef.current;
		if (!vp) return;
		const top = vp.scrollTop;
		if (suppressStickFromViewportScrollRef.current) {
			lastViewportScrollTopRef.current = top;
			return;
		}
		const prevTop = lastViewportScrollTopRef.current;
		lastViewportScrollTopRef.current = top;

		const distanceFromBottom = vp.scrollHeight - top - vp.clientHeight;

		const userScrolledUp = prevTop != null && top < prevTop - 0.5;
		const userScrolledDown = prevTop != null && top > prevTop + 0.5;

		if (isStreaming && userScrolledUp) {
			stickToBottomRef.current = false;
			return;
		}

		if (distanceFromBottom <= resumeWithinBottomPx) {
			if (!isStreaming) {
				stickToBottomRef.current = true;
			} else if (userScrolledDown) {
				stickToBottomRef.current = true;
			}
			return;
		}

		if (distanceFromBottom < releaseBeyondBottomPx) return;

		if (!isStreaming) {
			stickToBottomRef.current = false;
		}
	}, [isStreaming, releaseBeyondBottomPx, resumeWithinBottomPx]);

	const onWheelCapture = useCallback<WheelEventHandler<HTMLDivElement>>(
		(e) => {
			if (!interruptOnWheelUpWhileStreaming || !isStreaming) return;
			if (e.deltaY < 0) {
				stickToBottomRef.current = false;
			}
		},
		[interruptOnWheelUpWhileStreaming, isStreaming],
	);

	const onPointerDownCapture = useCallback<
		PointerEventHandler<HTMLDivElement>
	>(() => {
		if (!interruptOnPointerDownWhileStreaming || !isStreaming) return;
		stickToBottomRef.current = false;
	}, [interruptOnPointerDownWhileStreaming, isStreaming]);

	useLayoutEffect(() => {
		if (!isStreaming) return;
		if (!stickToBottomRef.current) return;
		suppressStickFromViewportScrollRef.current = true;
		flushScrollToBottom();
		requestAnimationFrame(() => {
			if (stickToBottomRef.current) {
				flushScrollToBottom();
			}
			requestAnimationFrame(() => {
				suppressStickFromViewportScrollRef.current = false;
			});
		});
	}, [contentRevision, isStreaming, flushScrollToBottom]);

	useLayoutEffect(() => {
		if (idleFlushKeyProp === undefined) return;
		if (idleFlushKeyProp === null || idleFlushKeyProp === '') {
			idleFlushAppliedKeyRef.current = null;
			return;
		}
		if (idleFlushAppliedKeyRef.current === idleFlushKeyProp) return;
		idleFlushAppliedKeyRef.current = idleFlushKeyProp;

		stickToBottomRef.current = true;
		flushScrollToBottom();
		requestAnimationFrame(() => {
			flushScrollToBottom();
			requestAnimationFrame(() => {
				flushScrollToBottom();
				window.setTimeout(() => {
					flushScrollToBottom();
				}, 0);
			});
		});
	}, [idleFlushKeyProp, flushScrollToBottom]);

	const scrollViewportHandlers = useMemo<StickToBottomScrollViewportHandlers>(
		() => ({
			onScroll,
			onWheelCapture,
			onPointerDownCapture,
		}),
		[onScroll, onWheelCapture, onPointerDownCapture],
	);

	return {
		viewportRef,
		scrollViewportHandlers,
		enableStickToBottom,
		disableStickToBottom,
		flushScrollToBottom,
	};
}
