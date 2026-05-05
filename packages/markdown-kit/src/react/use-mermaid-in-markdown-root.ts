import { type RefObject, useEffect, useLayoutEffect, useRef } from 'react';
import { runMermaidInMarkdownRoot } from '../mermaid/in-markdown.js';

/** 与 `MarkdownParser` 实例兼容，仅需 `enableMermaid`（与构造选项 `enableMermaid` 一致） */
export type MermaidMarkdownParserLike = {
	readonly enableMermaid: boolean;
};

type ThrottleState = {
	/** 浏览器 `window.setTimeout` 句柄（与 Node `Timeout` 类型区分，避免 d.ts 冲突） */
	timeoutId: number | null;
	lastInvoke: number;
};

/** `useMermaidInMarkdownRoot` 入参 */
export type UseMermaidInMarkdownRootParams = {
	rootRef: RefObject<HTMLElement | null>;
	preferDark: boolean;
	/** 在 `dangerouslySetInnerHTML` 等更新后参与依赖，例如渲染后的 html 或正文串 */
	trigger: unknown;
	parser: MermaidMarkdownParserLike;
	/**
	 * 流式等场景下 **节流**（非防抖）：保证持续有 chunk 时仍按固定间隔执行 `mermaid.run`。
	 * 若用防抖且每次 effect 都 `clearTimeout`，定时器会被不断重置，只有流式结束才触发（表现为「停流才出图」）。
	 * 默认 `0` 表示不节流；仍用代数丢弃过期双 rAF。
	 */
	throttleMs?: number;
	/**
	 * @deprecated 请改用 `throttleMs`；语义为节流间隔，行为与 `throttleMs` 相同。
	 */
	debounceMs?: number;
};

/**
 * Markdown HTML 插入 DOM 后渲染 Mermaid；是否执行由 `parser.enableMermaid` 决定。
 */
export function useMermaidInMarkdownRoot(
	params: UseMermaidInMarkdownRootParams,
): void {
	const {
		rootRef,
		preferDark,
		trigger,
		parser,
		throttleMs: throttleMsProp,
		debounceMs,
	} = params;
	const throttleMs = throttleMsProp ?? debounceMs ?? 0;

	/** 与 trigger 同步，避免闭包读到过期 html 而节点已更新 */
	const preferDarkRef = useRef(preferDark);
	preferDarkRef.current = preferDark;
	const throttleMsRef = useRef(throttleMs);
	throttleMsRef.current = throttleMs;

	/** 同实例内递增：作废过期的双 rAF，不在 cleanup 里 cancelAnimationFrame */
	const generationRef = useRef(0);

	const throttleStateRef = useRef<ThrottleState>({
		timeoutId: null,
		lastInvoke: 0,
	});

	useLayoutEffect(() => {
		if (!parser.enableMermaid) {
			const st = throttleStateRef.current;
			if (st.timeoutId !== null) {
				window.clearTimeout(st.timeoutId);
				st.timeoutId = null;
			}
			return;
		}
		const el = rootRef.current;
		if (!el) return;

		const runAfterLayout = (): void => {
			const runId = ++generationRef.current;
			requestAnimationFrame(() => {
				requestAnimationFrame(() => {
					if (runId !== generationRef.current) return;
					const root = rootRef.current;
					if (!root) return;
					void runMermaidInMarkdownRoot(root, {
						preferDark: preferDarkRef.current,
						// 节流模式 = 流式中间态，DSL 常不完整，抑制错误避免占位区反复闪错误样式
						suppressErrors: throttleMsRef.current > 0,
					});
				});
			});
		};

		if (throttleMs <= 0) {
			const st = throttleStateRef.current;
			if (st.timeoutId !== null) {
				window.clearTimeout(st.timeoutId);
				st.timeoutId = null;
			}
			runAfterLayout();
			return undefined;
		}

		const st = throttleStateRef.current;
		const now = Date.now();
		const remaining = throttleMs - (now - st.lastInvoke);

		const invoke = (): void => {
			if (st.timeoutId !== null) {
				window.clearTimeout(st.timeoutId);
				st.timeoutId = null;
			}
			st.lastInvoke = Date.now();
			runAfterLayout();
		};

		if (remaining <= 0) {
			invoke();
		} else if (st.timeoutId === null) {
			st.timeoutId = window.setTimeout(invoke, remaining);
		}
		// 已有挂起的 timeout 时不重置：到点执行时会读最新 DOM（rootRef）

		return undefined;
	}, [parser.enableMermaid, preferDark, trigger, rootRef, throttleMs]);

	useEffect(() => {
		return () => {
			const st = throttleStateRef.current;
			if (st.timeoutId !== null) {
				window.clearTimeout(st.timeoutId);
				st.timeoutId = null;
			}
			st.lastInvoke = 0;
		};
	}, []);
}
