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
	/** 单次滚到物理底部，不修改是否跟底的内部状态；默认尊重用户打断，传 `{ force: true }` 用于切换会话/历史就绪 */
	flushScrollToBottom: (options?: { force?: boolean }) => void;
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
	/** 用户于流式中主动上滑/滚轮打断后置位；恢复贴底前不再因 idleFlush / 流式结束布局变化自动滚底 */
	const userPinnedAwayRef = useRef(false);
	const suppressStickFromViewportScrollRef = useRef(false);
	const lastViewportScrollTopRef = useRef<number | null>(null);
	const idleFlushAppliedKeyRef = useRef<string | null>(null);
	/** 流式晚一拍布局（字体/代码高亮）补贴底；首滚须在 useLayoutEffect 同步完成，避免先绘后滚 */
	const streamFlushRafRef = useRef(0);
	const clearSuppressRafRef = useRef(0);

	useEffect(() => {
		if (resetKey === undefined || resetKey === null) return;
		if (typeof resetKey === 'string' && resetKey === '') return;
		stickToBottomRef.current = true;
		userPinnedAwayRef.current = false;
		lastViewportScrollTopRef.current = null;
	}, [resetKey]);

	useEffect(() => {
		return () => {
			if (streamFlushRafRef.current) {
				cancelAnimationFrame(streamFlushRafRef.current);
				streamFlushRafRef.current = 0;
			}
			if (clearSuppressRafRef.current) {
				cancelAnimationFrame(clearSuppressRafRef.current);
				clearSuppressRafRef.current = 0;
			}
		};
	}, []);

	const flushScrollToBottom = useCallback((options?: { force?: boolean }) => {
		const vp = viewportRef.current;
		if (!vp) return;
		if (
			!options?.force &&
			(userPinnedAwayRef.current || !stickToBottomRef.current)
		) {
			return;
		}
		vp.scrollTop = vp.scrollHeight;
	}, []);

	/** 跟底时写 scrollTop，并短暂抑制 onScroll 误判为用户上滑 */
	const stickFlush = useCallback(() => {
		if (!stickToBottomRef.current || userPinnedAwayRef.current) return;
		suppressStickFromViewportScrollRef.current = true;
		flushScrollToBottom();
		if (clearSuppressRafRef.current) {
			cancelAnimationFrame(clearSuppressRafRef.current);
		}
		clearSuppressRafRef.current = requestAnimationFrame(() => {
			clearSuppressRafRef.current = 0;
			suppressStickFromViewportScrollRef.current = false;
		});
	}, [flushScrollToBottom]);

	const enableStickToBottom = useCallback(() => {
		stickToBottomRef.current = true;
		userPinnedAwayRef.current = false;
	}, []);

	const disableStickToBottom = useCallback(() => {
		stickToBottomRef.current = false;
		userPinnedAwayRef.current = true;
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
			userPinnedAwayRef.current = true;
			return;
		}

		if (distanceFromBottom <= resumeWithinBottomPx) {
			if (!isStreaming) {
				if (!userPinnedAwayRef.current) {
					stickToBottomRef.current = true;
				}
			} else if (userScrolledDown || distanceFromBottom <= 8) {
				// 流式：主动下滚或已贴物理底部（含拖滚动条到底）时恢复跟滚
				stickToBottomRef.current = true;
				userPinnedAwayRef.current = false;
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
			if (!isStreaming) return;
			const target = e.target;
			if (
				target instanceof Element &&
				target.closest('.chat-md-code-block, [data-streaming-code-fence]')
			) {
				const absX = Math.abs(e.deltaX);
				const absY = Math.abs(e.deltaY);
				// 代码块内横滚或向上滚：打断贴底；向下滚交给 onScroll 在触底时恢复
				if (absX > absY || e.deltaY < 0) {
					stickToBottomRef.current = false;
					userPinnedAwayRef.current = true;
				}
				return;
			}
			if (!interruptOnWheelUpWhileStreaming) return;
			if (e.deltaY < 0) {
				stickToBottomRef.current = false;
				userPinnedAwayRef.current = true;
			}
		},
		[interruptOnWheelUpWhileStreaming, isStreaming],
	);

	const onPointerDownCapture = useCallback<PointerEventHandler<HTMLDivElement>>(
		(e) => {
			if (!interruptOnPointerDownWhileStreaming || !isStreaming) return;
			const target = e.target;
			// 代码块内点击/拖 pre 横滚条：不解除贴底，便于横滚后仍可通过滚到底恢复跟滚
			if (
				target instanceof Element &&
				target.closest('.chat-md-code-block, [data-streaming-code-fence]')
			) {
				return;
			}
			stickToBottomRef.current = false;
			userPinnedAwayRef.current = true;
		},
		[interruptOnPointerDownWhileStreaming, isStreaming],
	);

	// 同步贴底：须在 paint 前滚完。若推迟到 rAF，会先看到气泡撑高、「正在生成中」掉出视口，再被滚回 → 上下跳。
	useLayoutEffect(() => {
		if (!isStreaming) return;
		stickFlush();
		// 晚一拍布局（代码块/字体）再补一次；合并同帧多次 revision
		if (streamFlushRafRef.current) return;
		streamFlushRafRef.current = requestAnimationFrame(() => {
			streamFlushRafRef.current = 0;
			stickFlush();
		});
	}, [contentRevision, isStreaming, stickFlush]);

	/**
	 * 知识库等场景：消息列是独立 observer，content 先撑高、streamTick 晚一拍才到本 hook。
	 * 用 ResizeObserver 在内容高度变化时立刻贴底（paint 前），对齐 ChatBot 流式跟底。
	 */
	useLayoutEffect(() => {
		if (!isStreaming) return;
		const vp = viewportRef.current;
		if (!vp) return;
		const target =
			vp.querySelector<HTMLElement>('[data-stick-scroll-content]') ??
			(vp.firstElementChild as HTMLElement | null) ??
			vp;
		const ro = new ResizeObserver(() => {
			stickFlush();
		});
		ro.observe(target);
		return () => ro.disconnect();
	}, [isStreaming, stickFlush]);

	useLayoutEffect(() => {
		if (idleFlushKeyProp === undefined) return;
		if (idleFlushKeyProp === null || idleFlushKeyProp === '') {
			idleFlushAppliedKeyRef.current = null;
			return;
		}
		if (idleFlushAppliedKeyRef.current === idleFlushKeyProp) return;
		idleFlushAppliedKeyRef.current = idleFlushKeyProp;

		stickToBottomRef.current = true;
		userPinnedAwayRef.current = false;
		flushScrollToBottom({ force: true });
		requestAnimationFrame(() => {
			flushScrollToBottom({ force: true });
			requestAnimationFrame(() => {
				flushScrollToBottom({ force: true });
				window.setTimeout(() => {
					flushScrollToBottom({ force: true });
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
