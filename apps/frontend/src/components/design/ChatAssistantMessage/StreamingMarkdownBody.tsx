/**
 * 将正文按围栏拆块：普通 Markdown 仍用 innerHTML，mermaid 用独立 DOM 岛 + runMermaidInMarkdownRoot，
 * 避免流式时整段替换冲掉 SVG、造成全文闪烁。
 */

import type { MarkdownParser } from '@dnhyxc-ai/tools';
import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import { memo, type RefObject, useLayoutEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
	mermaidStreamingFallbackHtml,
	splitMarkdownByCodeFences,
} from '@/utils/splitMarkdownFences';

type MermaidIslandProps = {
	code: string;
	preferDark: boolean;
	isStreaming: boolean;
};

const MermaidIsland = memo(function MermaidIsland({
	code,
	preferDark,
	isStreaming,
}: MermaidIslandProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const genRef = useRef(0);
	/** 不参与 effect 依赖，避免停流时整岛 innerHTML 重跑导致闪屏 */
	const isStreamingRef = useRef(isStreaming);
	isStreamingRef.current = isStreaming;

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		host.innerHTML =
			'<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid"></div></div>';
		const inner = host.querySelector('.mermaid') as HTMLElement | null;
		if (!inner) return;
		inner.textContent = code;

		const runId = ++genRef.current;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (runId !== genRef.current) return;
				void runMermaidInMarkdownRoot(host, {
					preferDark,
					suppressErrors: isStreamingRef.current,
				});
			});
		});
	}, [code, preferDark]);

	return <div ref={hostRef} className="mermaid-island-root w-full" />;
});

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
					<MermaidIsland
						key={`mm-done-${i}`}
						code={part.text}
						preferDark={preferDark}
						isStreaming={isStreaming}
					/>
				);
			})}
		</div>
	);
}
