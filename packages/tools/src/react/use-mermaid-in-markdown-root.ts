import { type RefObject, useLayoutEffect, useRef } from 'react';
import { runMermaidInMarkdownRoot } from '../mermaid-in-markdown.js';

/** 与 `MarkdownParser` 实例兼容，仅需 `enableMermaid`（与构造选项 `enableMermaid` 一致） */
export type MermaidMarkdownParserLike = {
	readonly enableMermaid: boolean;
};

/** `useMermaidInMarkdownRoot` 入参 */
export type UseMermaidInMarkdownRootParams = {
	rootRef: RefObject<HTMLElement | null>;
	preferDark: boolean;
	/** 在 `dangerouslySetInnerHTML` 等更新后参与依赖，例如渲染后的 html 或正文串 */
	trigger: unknown;
	parser: MermaidMarkdownParserLike;
};

/**
 * Markdown HTML 插入 DOM 后渲染 Mermaid；是否执行由 `parser.enableMermaid` 决定。
 */
export function useMermaidInMarkdownRoot(
	params: UseMermaidInMarkdownRootParams,
): void {
	const { rootRef, preferDark, trigger, parser } = params;
	/** 与 trigger 同步，避免闭包读到过期 html 而节点已更新 */
	const preferDarkRef = useRef(preferDark);
	preferDarkRef.current = preferDark;

	useLayoutEffect(() => {
		if (!parser.enableMermaid) return;
		const el = rootRef.current;
		if (!el) return;

		let cancelled = false;
		let raf1 = 0;
		let raf2 = 0;
		// 双 rAF：等布局与 Radix ScrollArea 视口子树稳定后再跑，且整段为单次调度，避免并发 `mermaid.run`
		raf1 = requestAnimationFrame(() => {
			if (cancelled) return;
			raf2 = requestAnimationFrame(() => {
				if (cancelled) return;
				void runMermaidInMarkdownRoot(el, {
					preferDark: preferDarkRef.current,
				});
			});
		});

		return () => {
			cancelled = true;
			cancelAnimationFrame(raf1);
			cancelAnimationFrame(raf2);
		};
	}, [parser.enableMermaid, preferDark, trigger, rootRef]);
}
