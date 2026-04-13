/**
 * 正文：`splitForMermaidIslands` 拆出 ```mermaid 段；普通 markdown 段用 `parser.render`（宜 `enableMermaid: false`）。
 * 流式 `isStreaming` 时 mermaid 段仅用 `mermaidStreamingFallbackHtml` 静态预览，停流后再 `MermaidFenceIsland` 跑图，避免反复 `mermaid.run` 闪烁。
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import type {
	MarkdownMermaidSplitPart,
	MarkdownParser,
} from '@dnhyxc-ai/tools';
import { type RefObject, useMemo } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import { mermaidStreamingFallbackHtml } from '@/utils/splitMarkdownFences';

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
	const parts = useMemo(
		() => parser.splitForMermaidIslands(markdown),
		[markdown, parser],
	);
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
				// 流式未结束：始终用静态 DSL 预览，不挂 MermaidFenceIsland，避免闭合后仍随 chunk 重跑
				// innerHTML + mermaid.run 造成闪烁；停流后再跑图。与 markdown 代码块拆分无关。
				if (isStreaming || !part.complete) {
					return (
						<div
							key={`mm-${i}`}
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
						isStreaming={false}
						openMermaidPreview={openMermaidPreview}
					/>
				);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}
