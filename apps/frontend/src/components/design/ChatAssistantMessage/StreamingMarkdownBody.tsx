/**
 * 正文：优先用 `MarkdownParser.splitForMermaidIslands`（markdown-it parse）拆出 ```mermaid 岛，
 * 普通 markdown 段仍走 `parser.render`，保证列表内代码块等边界与渲染器一致。
 *
 * 流式尾部「未闭合 mermaid 围栏」不会产生 fence token：用按行围栏解析规则仅探测尾部开放 mermaid，
 * 将其从 markdown 段中剥离出来交给 MermaidFenceIsland，既能边输出边出图，也不会破坏普通代码块渲染。
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import type {
	MarkdownMermaidSplitPart,
	MarkdownParser,
} from '@dnhyxc-ai/tools';
import { type RefObject, useMemo } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import {
	fenceClosingIndentMatchesOpen,
	isPlausibleMarkdownFenceIndent,
} from '@/utils/markdownFenceLineParser';
import { mermaidStreamingFallbackHtml } from '@/utils/splitMarkdownFences';

function splitOpenMermaidTail(
	source: string,
): { prefix: string; body: string } | null {
	const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const openMatch = /^(\s*)(`{3,})([^`]*)$/.exec(line.trimEnd());
		if (!openMatch) continue;
		const openIndent = openMatch[1] ?? '';
		const tickLen = openMatch[2]?.length ?? 3;
		const lang = (openMatch[3] ?? '').trim().split(/\s+/)[0]?.toLowerCase();
		if (!isPlausibleMarkdownFenceIndent(openIndent)) continue;
		if (lang !== 'mermaid') continue;

		let j = i + 1;
		let closed = false;
		while (j < lines.length) {
			const cur = lines[j];
			const closeMatch = /^(\s*)(`{3,})\s*$/.exec(cur.trimEnd());
			if (
				closeMatch &&
				(closeMatch[2]?.length ?? 0) >= tickLen &&
				fenceClosingIndentMatchesOpen(openIndent, closeMatch[1] ?? '')
			) {
				closed = true;
				break;
			}
			j++;
		}

		if (closed) {
			i = j;
			continue;
		}

		// prefix 必须保留行末换行：否则下一段以 ``` 开头时会被拼成 `上一行内容```lang`，围栏失效。
		const prefixLines = lines.slice(0, i);
		const prefix = prefixLines.length > 0 ? `${prefixLines.join('\n')}\n` : '';
		const body = lines.slice(i + 1).join('\n');
		return { prefix, body };
	}
	return null;
}

export type StreamingMarkdownBodyProps = {
	markdown: string;
	parser: MarkdownParser;
	className?: string;
	preferDark: boolean;
	isStreaming: boolean;
	containerRef?: RefObject<HTMLDivElement | null>;
};

export function StreamingMarkdownBody({
	markdown,
	parser,
	className,
	preferDark,
	isStreaming,
	containerRef,
}: StreamingMarkdownBodyProps) {
	const parts = useMemo<MarkdownMermaidSplitPart[]>(() => {
		if (!isStreaming) {
			return parser.splitForMermaidIslands(markdown);
		}
		const openTail = splitOpenMermaidTail(markdown);
		if (!openTail) {
			return parser.splitForMermaidIslands(markdown);
		}
		const headParts = parser.splitForMermaidIslands(openTail.prefix);
		return [
			...headParts,
			{ type: 'mermaid', text: openTail.body, complete: false },
		];
	}, [markdown, parser, isStreaming]);
	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview();

	return (
		<div ref={containerRef} className={cn('streaming-md-body', className)}>
			{parts.map((part: MarkdownMermaidSplitPart, i: number) => {
				if (part.type === 'markdown') {
					return (
						<div
							key={`md-${i}`}
							dangerouslySetInnerHTML={{ __html: parser.render(part.text) }}
						/>
					);
				}
				if (!part.complete) {
					return (
						<div
							key={`mm-open-${i}`}
							dangerouslySetInnerHTML={{
								__html: mermaidStreamingFallbackHtml(part.text),
							}}
						/>
					);
				}
				return (
					<MermaidFenceIsland
						key={`mm-done-${i}`}
						code={part.text}
						preferDark={preferDark}
						isStreaming={isStreaming}
						openMermaidPreview={openMermaidPreview}
					/>
				);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}
