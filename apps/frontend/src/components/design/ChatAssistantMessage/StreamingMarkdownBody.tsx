/**
 * 正文：`splitForMermaidIslands` 拆出 ```mermaid 段；普通 markdown 段用 `parser.render`（宜 `enableMermaid: false`）。
 *
 * 新策略（流式 Mermaid 且不破坏代码块）：
 * - **闭合**的 ```mermaid：交给 `splitForMermaidIslands`（markdown-it parse）拆分，保证列表/代码块边界与 render 一致
 * - **未闭合**的 ```mermaid（只可能出现在流式尾部）：用按行围栏解析器只探测“尾部开放 mermaid”，并单独渲染 MermaidFenceIsland
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

function splitOpenMermaidTail(source: string): {
	prefix: string;
	body: string;
} | null {
	const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n');

	// 扫描全量：遇到 ```mermaid 就找闭合；若找不到且到达末尾，则视为“尾部开放 mermaid”
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
			i = j; // 跳过该围栏（含闭合行），继续找后续
			continue;
		}

		// 未闭合且位于尾部：prefix 为开围栏之前；body 为开围栏之后到末尾
		const prefix = lines.slice(0, i).join('\n');
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
	const parts = useMemo(() => {
		if (!isStreaming) {
			return parser.splitForMermaidIslands(markdown);
		}
		const openTail = splitOpenMermaidTail(markdown);
		if (!openTail) {
			return parser.splitForMermaidIslands(markdown);
		}
		// prefix 用 markdown-it parse 拆分闭合 mermaid（稳定不破坏普通代码块）
		const headParts = parser.splitForMermaidIslands(openTail.prefix);
		const tailPart: MarkdownMermaidSplitPart = {
			type: 'mermaid',
			text: openTail.body,
			complete: false,
		};
		return [...headParts, tailPart];
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
				if (!part.complete && !isStreaming) {
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
						key={`mm-${i}`}
						code={part.text}
						preferDark={preferDark}
						isStreaming={isStreaming || !part.complete}
						openMermaidPreview={openMermaidPreview}
					/>
				);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}
