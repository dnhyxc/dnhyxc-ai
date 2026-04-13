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
import { Button } from '@ui/index';
import { CheckCircle, Code2, Copy, Waypoints } from 'lucide-react';
import { type RefObject, useMemo, useRef, useState } from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/utils/clipboard';
import {
	fenceClosingIndentMatchesOpen,
	isPlausibleMarkdownFenceIndent,
} from '@/utils/markdownFenceLineParser';
import { mermaidStreamingFallbackHtml } from '@/utils/splitMarkdownFences';

function splitOpenMermaidTail(
	source: string,
): { prefix: string; body: string; openLine: number } | null {
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
		return { prefix, body, openLine: i };
	}
	return null;
}

export type StreamingMarkdownBodyProps = {
	markdown: string;
	parser: MarkdownParser;
	className?: string;
	preferDark: boolean;
	isStreaming: boolean;
	/** 每块 Mermaid 的默认展示模式（不传则默认图）；每块仍可独立切换 */
	defaultMermaidViewMode?: 'diagram' | 'code';
	containerRef?: RefObject<HTMLDivElement | null>;
};

function hashText(s: string): string {
	// 简单稳定 hash（djb2），用于给“同一块 mermaid”生成稳定 id
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = (h * 33) ^ s.charCodeAt(i);
	}
	return (h >>> 0).toString(36);
}

export function StreamingMarkdownBody({
	markdown,
	parser,
	className,
	preferDark,
	isStreaming,
	defaultMermaidViewMode = 'diagram',
	containerRef,
}: StreamingMarkdownBodyProps) {
	const openMermaidId = useMemo(() => {
		if (!isStreaming) return null;
		const openTail = splitOpenMermaidTail(markdown);
		return openTail ? `mmd-open-line-${openTail.openLine}` : null;
	}, [markdown, isStreaming]);

	// 每块 Mermaid 独立切换：blockId -> mode
	const [mermaidModeById, setMermaidModeById] = useState<
		Record<string, 'diagram' | 'code'>
	>({});
	// 每块 Mermaid 独立复制反馈：blockId -> copied
	const [copiedById, setCopiedById] = useState<Record<string, boolean>>({});
	const copiedTimersRef = useRef<Record<string, number>>({});

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

				// Mermaid：每块独立切换（图/代码）
				const blockId = part.complete
					? `mmd-${hashText(part.text)}`
					: (openMermaidId ?? `mmd-open-${i}`);
				const mode = mermaidModeById[blockId] ?? defaultMermaidViewMode;
				const toggle = () => {
					setMermaidModeById((prev) => ({
						...prev,
						[blockId]: mode === 'diagram' ? 'code' : 'diagram',
					}));
				};
				const copied = copiedById[blockId] === true;
				const onCopy = () => {
					void (async () => {
						await copyToClipboard(`\`\`\`mermaid\n${part.text}\n\`\`\``);
						const prevTid = copiedTimersRef.current[blockId];
						if (prevTid) window.clearTimeout(prevTid);
						setCopiedById((prev) => ({ ...prev, [blockId]: true }));
						copiedTimersRef.current[blockId] = window.setTimeout(() => {
							setCopiedById((prev) => ({ ...prev, [blockId]: false }));
						}, 1600);
					})();
				};

				const header = (
					<div className="flex items-center justify-end gap-2 my-1.5 select-none">
						<Button
							variant="dynamic"
							size="sm"
							className="h-7 px-2 bg-theme/5 hover:bg-theme/10 border border-theme/10"
							onClick={onCopy}
						>
							{copied ? (
								<CheckCircle size={15} className="text-teal-400" />
							) : (
								<Copy size={15} />
							)}
							<span className={copied ? 'text-teal-400' : ''}>复制</span>
						</Button>
						<Button
							variant="dynamic"
							size="sm"
							className="h-7 px-2 bg-theme/5 hover:bg-theme/10 border border-theme/10"
							onClick={toggle}
						>
							{mode === 'diagram' ? (
								<Code2 size={16} />
							) : (
								<Waypoints size={16} />
							)}
							<span>{mode === 'diagram' ? '代码' : '图表'}</span>
						</Button>
					</div>
				);

				if (mode === 'code') {
					return (
						<div key={`mm-wrap-${blockId}`}>
							{header}
							<div
								dangerouslySetInnerHTML={{
									__html: mermaidStreamingFallbackHtml(part.text),
								}}
							/>
						</div>
					);
				}

				// diagram 模式：闭合/未闭合都交给 MermaidFenceIsland；岛内“成功才提交”避免流式错误 SVG 闪烁
				return (
					<div key={`mm-wrap-${blockId}`}>
						{header}
						<MermaidFenceIsland
							code={part.text}
							preferDark={preferDark}
							isStreaming={isStreaming || !part.complete}
							openMermaidPreview={openMermaidPreview}
						/>
					</div>
				);
			})}
			{mermaidImagePreviewModal}
		</div>
	);
}
