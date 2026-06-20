/**
 * 正文：优先用 `MarkdownParser.splitForMermaidIslands`（markdown-it parse）拆出 ```mermaid 岛，
 * 普通 markdown 段仍走 `parser.render`，保证列表内代码块等边界与渲染器一致。
 *
 * 流式阶段：
 * - 代码围栏 → StreamingCodeFenceBlock（稳定 fenceKey，闭合后冻结 DOM）
 * - 正文段 → StableMarkdownChunk memo，仅尾段增长
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import { MermaidFenceToolbarActions } from '@design/MermaidFenceToolbar';
import type { MarkdownParser } from '@dnhyxc-ai/markdown-kit';
import { memo, type RefObject, useMemo } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import { ChatI18nT } from '@/types/chat';
import {
	hashText,
	mermaidStreamingFallbackHtml,
	type StreamingBodyPart,
	splitForMermaidIslandsWithOpenTail,
	splitStreamingBodyParts,
} from '@/utils/splitMarkdownFences';
import { StreamingCodeFenceBlock } from './StreamingCodeFenceBlock';

export type StreamingMarkdownBodyProps = {
	markdown: string;
	parser: MarkdownParser;
	className?: string;
	preferDark: boolean;
	isStreaming: boolean;
	defaultMermaidViewMode?: 'diagram' | 'code';
	containerRef?: RefObject<HTMLDivElement | null>;
	t?: ChatI18nT;
	renderedMarkdownHtmlPostProcess?: (html: string) => string;
};

type StableMarkdownChunkProps = {
	partKey: string;
	text: string;
	parser: MarkdownParser;
	renderedMarkdownHtmlPostProcess?: (html: string) => string;
};

function StableMarkdownChunkInner({
	text,
	parser,
	renderedMarkdownHtmlPostProcess,
}: StableMarkdownChunkProps) {
	const html = useMemo(() => {
		let out = parser.render(text);
		if (renderedMarkdownHtmlPostProcess) {
			out = renderedMarkdownHtmlPostProcess(out);
		}
		return out;
	}, [text, parser, renderedMarkdownHtmlPostProcess]);

	return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

const StableMarkdownChunk = memo(
	StableMarkdownChunkInner,
	(prev, next) =>
		prev.partKey === next.partKey &&
		prev.text === next.text &&
		prev.parser === next.parser &&
		prev.renderedMarkdownHtmlPostProcess ===
			next.renderedMarkdownHtmlPostProcess,
);

function StreamingMarkdownBodyInner({
	markdown,
	parser,
	className,
	preferDark,
	isStreaming,
	defaultMermaidViewMode = 'diagram',
	containerRef,
	t,
	renderedMarkdownHtmlPostProcess,
}: StreamingMarkdownBodyProps) {
	const streamBundle = useMemo(() => {
		if (!isStreaming) {
			const split = splitForMermaidIslandsWithOpenTail({
				markdown,
				parser,
				enableOpenTail: true,
				openMermaidIdPrefix: 'mmd-open-line-',
			});
			return {
				parts: split.parts.map((p) =>
					p.type === 'mermaid'
						? { type: 'mermaid' as const, text: p.text, complete: true }
						: {
								type: 'markdown' as const,
								text: p.text,
								partKey: `md-${hashText(p.text)}`,
							},
				),
				openMermaidId: null as string | null,
			};
		}
		return splitStreamingBodyParts(markdown, parser, 'mmd-open-line-');
	}, [markdown, parser, isStreaming]);

	const { parts, openMermaidId } = streamBundle;

	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview(t);

	const renderMermaidPart = (
		part: Extract<StreamingBodyPart, { type: 'mermaid' }>,
		i: number,
	) => {
		const blockId = part.complete
			? `mmd-${hashText(part.text)}`
			: (openMermaidId ?? `mmd-open-${i}`);

		return (
			<MermaidFenceToolbarActions
				key={`mm-wrap-${blockId}`}
				blockId={blockId}
				mermaidCode={part.text}
				openMermaidPreview={openMermaidPreview}
				defaultViewMode={defaultMermaidViewMode}
				t={t}
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
							isStreaming={!part.complete}
							openMermaidPreview={openMermaidPreview}
						/>
					)
				}
			</MermaidFenceToolbarActions>
		);
	};

	return (
		<div
			ref={containerRef}
			className={cn(
				'streaming-md-body',
				isStreaming && 'streaming-md-body--streaming',
				className,
			)}
		>
			{parts.map((part: StreamingBodyPart, i: number) => {
				if (part.type === 'codeFence') {
					return (
						<StreamingCodeFenceBlock
							key={part.fenceKey}
							fenceKey={part.fenceKey}
							lang={part.lang}
							body={part.body}
							complete={part.complete}
							parser={parser}
						/>
					);
				}
				if (part.type === 'markdown') {
					if (isStreaming) {
						return (
							<StableMarkdownChunk
								key={part.partKey}
								partKey={part.partKey}
								text={part.text}
								parser={parser}
								renderedMarkdownHtmlPostProcess={
									renderedMarkdownHtmlPostProcess
								}
							/>
						);
					}
					let html = parser.render(part.text);
					if (renderedMarkdownHtmlPostProcess) {
						html = renderedMarkdownHtmlPostProcess(html);
					}
					return (
						<div
							key={part.partKey}
							dangerouslySetInnerHTML={{ __html: html }}
						/>
					);
				}
				return renderMermaidPart(part, i);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}

function areStreamingMarkdownBodyPropsEqual(
	prev: Readonly<StreamingMarkdownBodyProps>,
	next: Readonly<StreamingMarkdownBodyProps>,
): boolean {
	return (
		prev.markdown === next.markdown &&
		prev.parser === next.parser &&
		prev.preferDark === next.preferDark &&
		prev.isStreaming === next.isStreaming &&
		(prev.defaultMermaidViewMode ?? 'diagram') ===
			(next.defaultMermaidViewMode ?? 'diagram') &&
		prev.renderedMarkdownHtmlPostProcess ===
			next.renderedMarkdownHtmlPostProcess &&
		prev.containerRef === next.containerRef &&
		prev.className === next.className &&
		prev.t === next.t
	);
}

export const StreamingMarkdownBody = memo(
	StreamingMarkdownBodyInner,
	areStreamingMarkdownBodyPropsEqual,
);
