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
} from '@dnhyxc-ai/markdown-kit';
import { memo, type RefObject, useMemo } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import { ChatI18nT } from '@/types/chat';
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
	/** i18n 翻译函数（可选）；不传则沿用 MermaidFenceToolbarActions 的默认中文文案 */
	t?: ChatI18nT;
	/**
	 * 对 markdown-it 产出 HTML 的后处理（例如联网引用占位符 → <a>）。
	 * 仅在 `type==='markdown'` 片段上调用，不会影响 ```mermaid``` 岛。
	 */
	renderedMarkdownHtmlPostProcess?: (html: string) => string;
};

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
		useMermaidImagePreview(t);

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
					let html = parser.render(part.text);
					if (renderedMarkdownHtmlPostProcess) {
						html = renderedMarkdownHtmlPostProcess(html);
					}
					return (
						<div key={`md-${i}`} dangerouslySetInnerHTML={{ __html: html }} />
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

/** 与父级（如角标悬浮 state）解耦，避免无关节点重绘时用 innerHTML 冲掉正文内已改写的合并胶囊 */
export const StreamingMarkdownBody = memo(
	StreamingMarkdownBodyInner,
	areStreamingMarkdownBodyPropsEqual,
);
