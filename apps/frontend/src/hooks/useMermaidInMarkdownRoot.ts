import { type RefObject, useLayoutEffect } from 'react';
import { runMermaidInMarkdownRoot } from '@/utils/mermaidMarkdown';

/**
 * 在 `dangerouslySetInnerHTML` 等写入 Markdown 后，对容器内 Mermaid 占位块执行渲染。
 * @param trigger 变化时重新扫描（如 html 串、正文内容、主题）
 */
export function useMermaidInMarkdownRoot(
	rootRef: RefObject<HTMLElement | null>,
	preferDark: boolean,
	trigger: unknown,
): void {
	useLayoutEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		void runMermaidInMarkdownRoot(el, { preferDark });
	}, [preferDark, trigger]);
}
