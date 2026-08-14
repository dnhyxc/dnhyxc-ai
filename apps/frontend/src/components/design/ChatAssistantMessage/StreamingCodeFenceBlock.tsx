/**
 * 流式代码围栏：未闭合时首帧 parser 渲染外壳，后续仅更新 pre>code 并保留 scrollLeft；
 * 闭合后冻结 DOM，后续正文继续流式时不再触碰该代码块。
 */

import {
	MARKDOWN_CODE_FENCE_SOURCE_CODE_SELECTOR,
	type MarkdownParser,
} from '@dnhyxc-ai/markdown-kit';
import { memo, useLayoutEffect, useRef } from 'react';
import {
	restoreTextOffsetsInRoot,
	snapshotTextOffsetsInRoot,
} from '@/utils/domTextSelection';
import { patchIncompleteNonMermaidFence } from '@/utils/splitMarkdownFences';

export type StreamingCodeFenceBlockProps = {
	fenceKey: string;
	lang: string;
	body: string;
	complete: boolean;
	parser: MarkdownParser;
};

function renderOpenFenceMarkdown(lang: string, body: string): string {
	return `\`\`\`${lang}\n${body}`;
}

function renderCompleteFenceMarkdown(lang: string, body: string): string {
	return `\`\`\`${lang}\n${body}\n\`\`\``;
}

function extractCodeFromRenderedFence(
	parser: MarkdownParser,
	markdown: string,
): { className: string; innerHTML: string } | null {
	const html = parser.render(markdown);
	if (typeof DOMParser === 'undefined') return null;
	const doc = new DOMParser().parseFromString(html, 'text/html');
	const code = doc.querySelector(MARKDOWN_CODE_FENCE_SOURCE_CODE_SELECTOR);
	if (!code) return null;
	return { className: code.className, innerHTML: code.innerHTML };
}

function StreamingCodeFenceBlockInner({
	fenceKey,
	lang,
	body,
	complete,
	parser,
}: StreamingCodeFenceBlockProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const langRef = useRef(lang);
	const frozenRef = useRef(false);

	useLayoutEffect(() => {
		if (frozenRef.current) return;

		const root = rootRef.current;
		if (!root) return;

		if (complete) {
			const scrollLeft =
				root.querySelector<HTMLElement>('.chat-md-code-block pre')
					?.scrollLeft ?? 0;
			const snap = snapshotTextOffsetsInRoot(root);
			root.innerHTML = parser.render(renderCompleteFenceMarkdown(lang, body));
			const pre = root.querySelector<HTMLElement>('.chat-md-code-block pre');
			if (pre) pre.scrollLeft = scrollLeft;
			if (snap) restoreTextOffsetsInRoot(root, snap);
			frozenRef.current = true;
			langRef.current = lang;
			return;
		}

		if (langRef.current !== lang) {
			langRef.current = lang;
			const patched = patchIncompleteNonMermaidFence(
				renderOpenFenceMarkdown(lang, body),
			);
			const snap = snapshotTextOffsetsInRoot(root);
			root.innerHTML = parser.render(patched);
			if (snap) restoreTextOffsetsInRoot(root, snap);
			return;
		}

		const pre = root.querySelector<HTMLElement>('.chat-md-code-block pre');
		const code = pre?.querySelector<HTMLElement>('code');
		if (!pre || !code) {
			const patched = patchIncompleteNonMermaidFence(
				renderOpenFenceMarkdown(lang, body),
			);
			const snap = snapshotTextOffsetsInRoot(root);
			root.innerHTML = parser.render(patched);
			if (snap) restoreTextOffsetsInRoot(root, snap);
			return;
		}

		const scrollLeft = pre.scrollLeft;
		const scrollTop = pre.scrollTop;
		const snap = snapshotTextOffsetsInRoot(root);
		const patched = patchIncompleteNonMermaidFence(
			renderOpenFenceMarkdown(lang, body),
		);
		const next = extractCodeFromRenderedFence(parser, patched);
		if (next) {
			code.className = next.className;
			code.innerHTML = next.innerHTML;
		} else {
			code.textContent = body;
		}
		pre.scrollLeft = scrollLeft;
		pre.scrollTop = scrollTop;
		if (snap) restoreTextOffsetsInRoot(root, snap);
	}, [body, complete, lang, parser]);

	return (
		<div ref={rootRef} data-streaming-code-fence data-fence-key={fenceKey} />
	);
}

export const StreamingCodeFenceBlock = memo(
	StreamingCodeFenceBlockInner,
	(prev, next) =>
		prev.fenceKey === next.fenceKey &&
		prev.lang === next.lang &&
		prev.body === next.body &&
		prev.complete === next.complete &&
		prev.parser === next.parser,
);
