/**
 * 单块 ```mermaid 围栏：独立 DOM 岛 + runMermaidInMarkdownRoot，
 * 避免父级整段 dangerouslySetInnerHTML 替换冲掉 SVG。
 */

import { normalizeMermaidFenceBody } from '@dnhyxc-ai/tools';
import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import { memo, useLayoutEffect, useRef } from 'react';
import { useMermaidDiagramClickPreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';

export type MermaidFenceIslandProps = {
	code: string;
	preferDark: boolean;
	/** 流式中间态时抑制 Mermaid 报错闪烁 */
	isStreaming?: boolean;
	openMermaidPreview?: (dataUrl: string) => void;
};

const noopOpenPreview = (_dataUrl: string) => {};

export const MermaidFenceIsland = memo(function MermaidFenceIsland({
	code,
	preferDark,
	isStreaming = false,
	openMermaidPreview,
}: MermaidFenceIslandProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const genRef = useRef(0);
	/** 不参与 effect 依赖，避免停流时整岛 innerHTML 重跑导致闪屏 */
	const isStreamingRef = useRef(isStreaming);
	isStreamingRef.current = isStreaming;

	const previewEnabled = Boolean(openMermaidPreview);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		host.innerHTML =
			'<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid"></div></div>';
		const inner = host.querySelector('.mermaid') as HTMLElement | null;
		if (!inner) return;
		inner.textContent = normalizeMermaidFenceBody(code);

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

	useMermaidDiagramClickPreview(
		hostRef,
		openMermaidPreview ?? noopOpenPreview,
		previewEnabled,
		code,
	);

	return (
		<div
			ref={hostRef}
			className={cn(
				'mermaid-island-root w-full',
				previewEnabled && '[&_.markdown-mermaid-wrap_.mermaid]:cursor-zoom-in',
			)}
		/>
	);
});
