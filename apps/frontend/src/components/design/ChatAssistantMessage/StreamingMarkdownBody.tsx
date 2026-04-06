/**
 * 将正文按围栏拆块：普通 Markdown 仍用 innerHTML，mermaid 用独立 DOM 岛 + runMermaidInMarkdownRoot，
 * 避免流式时整段替换冲掉 SVG、造成全文闪烁。
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import type { MarkdownParser } from '@dnhyxc-ai/tools';
import { type RefObject, useMemo } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import {
	mermaidStreamingFallbackHtml,
	splitMarkdownByCodeFences,
} from '@/utils/splitMarkdownFences';

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
	const parts = useMemo(() => splitMarkdownByCodeFences(markdown), [markdown]);
	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview();

	return (
		<div ref={containerRef} className={cn('streaming-md-body', className)}>
			{parts.map((part, i) => {
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
