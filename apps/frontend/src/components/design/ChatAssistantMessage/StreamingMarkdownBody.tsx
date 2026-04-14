/**
 * 正文：优先用 `MarkdownParser.splitForMermaidIslands`（markdown-it parse）拆出 ```mermaid 岛，
 * 普通 markdown 段仍走 `parser.render`，保证列表内代码块等边界与渲染器一致。
 *
 * 流式尾部「未闭合 mermaid 围栏」不会产生 fence token：用按行围栏解析规则仅探测尾部开放 mermaid，
 * 将其从 markdown 段中剥离出来交给 MermaidFenceIsland，既能边输出边出图，也不会破坏普通代码块渲染。
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import { MermaidFenceToolbarActions } from '@design/MermaidFenceToolbar';
import type {
	MarkdownMermaidSplitPart,
	MarkdownParser,
} from '@dnhyxc-ai/tools';
import { type RefObject, useMemo } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import {
	hashText,
	mermaidStreamingFallbackHtml,
	splitForMermaidIslandsWithOpenTail,
} from '@/utils/splitMarkdownFences';

export type StreamingMarkdownBodyProps = {
	markdown: string;
	parser: MarkdownParser;
	className?: string;
	preferDark: boolean;
	isStreaming: boolean;
	/** 每块 Mermaid 的默认展示模式（不传则默认图）；每块仍可独立切换 */
	defaultMermaidViewMode?: 'diagram' | 'code';
	containerRef?: RefObject<HTMLDivElement | null>;
	isSharing?: boolean;
};

export function StreamingMarkdownBody({
	markdown,
	parser,
	className,
	preferDark,
	isStreaming,
	defaultMermaidViewMode = 'diagram',
	containerRef,
	isSharing,
}: StreamingMarkdownBodyProps) {
	const { parts, openMermaidId } = useMemo(
		() =>
			splitForMermaidIslandsWithOpenTail({
				markdown,
				parser,
				enableOpenTail: isStreaming,
				openMermaidIdPrefix: 'mmd-open-line-',
			}),
		[markdown, parser, isStreaming],
	);

	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview();

	const renderMermaidPart = (
		part: Extract<MarkdownMermaidSplitPart, { type: 'mermaid' }>,
		i: number,
	) => {
		// Mermaid：每块独立切换（图/代码）
		const blockId = part.complete
			? `mmd-${hashText(part.text)}`
			: (openMermaidId ?? `mmd-open-${i}`);

		// 顶栏交互在 MermaidFenceToolbarActions 内；下方内容由 mode 决定
		return (
			<MermaidFenceToolbarActions
				key={`mm-wrap-${blockId}`}
				blockId={blockId}
				mermaidCode={part.text}
				openMermaidPreview={openMermaidPreview}
				defaultViewMode={defaultMermaidViewMode}
				isSharing={isSharing}
			>
				{(mode) =>
					mode === 'code' ? (
						<div
							dangerouslySetInnerHTML={{
								__html: mermaidStreamingFallbackHtml(part.text),
							}}
						/>
					) : (
						<MermaidFenceIsland
							code={part.text}
							preferDark={preferDark}
							isStreaming={isStreaming || !part.complete}
							openMermaidPreview={openMermaidPreview}
						/>
					)
				}
			</MermaidFenceToolbarActions>
		);
	};

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
				return renderMermaidPart(part, i);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}
