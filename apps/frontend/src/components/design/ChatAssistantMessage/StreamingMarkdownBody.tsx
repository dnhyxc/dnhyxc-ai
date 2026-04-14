/**
 * 正文：优先用 `MarkdownParser.splitForMermaidIslands`（markdown-it parse）拆出 ```mermaid 岛，
 * 普通 markdown 段仍走 `parser.render`，保证列表内代码块等边界与渲染器一致。
 *
 * 流式尾部「未闭合 mermaid 围栏」不会产生 fence token：用按行围栏解析规则仅探测尾部开放 mermaid，
 * 将其从 markdown 段中剥离出来交给 MermaidFenceIsland，既能边输出边出图，也不会破坏普通代码块渲染。
 */

import { MermaidFenceIsland } from '@design/MermaidFenceIsland';
import { MermaidFenceToolbar } from '@design/MermaidFenceToolbar';
import type {
	MarkdownMermaidSplitPart,
	MarkdownParser,
} from '@dnhyxc-ai/tools';
import { Button } from '@ui/index';
import { CheckCircle, Code2, Copy, Eye } from 'lucide-react';
import {
	type MouseEvent as ReactMouseEvent,
	type RefObject,
	useMemo,
	useRef,
	useState,
} from 'react';
import { useMermaidImagePreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/utils/clipboard';
import { mermaidSvgToPreviewDataUrl } from '@/utils/mermaidImagePreview';
import {
	hashText,
	mermaidStreamingFallbackHtml,
	splitForMermaidIslandsWithOpenTail,
} from '@/utils/splitMarkdownFences';

const COPY_FEEDBACK_MS = 1600;

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

export function StreamingMarkdownBody({
	markdown,
	parser,
	className,
	preferDark,
	isStreaming,
	defaultMermaidViewMode = 'diagram',
	containerRef,
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

	// 每块 Mermaid 独立切换：blockId -> mode
	const [mermaidModeById, setMermaidModeById] = useState<
		Record<string, 'diagram' | 'code'>
	>({});
	// 每块 Mermaid 独立复制反馈：blockId -> copied
	const [copiedById, setCopiedById] = useState<Record<string, boolean>>({});
	const copiedTimersRef = useRef<Record<string, number>>({});

	const { openMermaidPreview, mermaidImagePreviewModal } =
		useMermaidImagePreview();

	const markCopied = (blockId: string) => {
		const prevTid = copiedTimersRef.current[blockId];
		if (prevTid) window.clearTimeout(prevTid);
		setCopiedById((prev) => ({ ...prev, [blockId]: true }));
		copiedTimersRef.current[blockId] = window.setTimeout(() => {
			setCopiedById((prev) => ({ ...prev, [blockId]: false }));
		}, COPY_FEEDBACK_MS);
	};

	const renderMermaidPart = (
		part: Extract<MarkdownMermaidSplitPart, { type: 'mermaid' }>,
		i: number,
	) => {
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
				markCopied(blockId);
			})();
		};

		const onPreview = (e: ReactMouseEvent<HTMLButtonElement>) => {
			const btn = e.currentTarget;
			const scope = btn.closest<HTMLElement>(
				`[data-mermaid-preview-scope="${blockId}"]`,
			);
			if (!scope) return;
			const svg = scope.querySelector('.markdown-mermaid-wrap .mermaid svg');
			if (!(svg instanceof SVGElement)) return;
			const url = mermaidSvgToPreviewDataUrl(svg);
			if (url) openMermaidPreview(url);
		};

		// Mermaid 工具条：独立组件内 sticky + 粘顶双态样式，不包裹 MermaidFenceIsland，避免影响流式/离屏渲染（见 docs/mermaid-fence-toolbar-sticky.md）
		const header = (
			<MermaidFenceToolbar blockId={blockId}>
				<Button
					variant="link"
					size="sm"
					className="h-7 px-2 text-textcolor/80"
					onClick={toggle}
				>
					<Code2 size={16} />
					<span>{mode === 'diagram' ? '代码' : '图表'}</span>
				</Button>
				<div className="flex items-center justify-end">
					<Button
						variant="link"
						className="text-textcolor/80"
						size="sm"
						onClick={onCopy}
					>
						{copied ? <CheckCircle className="text-teal-500" /> : <Copy />}
						<span className={cn(copied ? 'text-teal-500' : '', 'text-sm')}>
							{copied ? '已复制' : '复制'}
						</span>
					</Button>
					<Button
						variant="link"
						size="sm"
						className="text-textcolor/80"
						onClick={onPreview}
						disabled={mode !== 'diagram'}
					>
						<Eye size={16} />
						<span className="text-sm">预览</span>
					</Button>
				</div>
			</MermaidFenceToolbar>
		);

		if (mode === 'code') {
			return (
				<div
					key={`mm-wrap-${blockId}`}
					data-mermaid-preview-scope={blockId}
					className="mt-4.5"
				>
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
			<div
				key={`mm-wrap-${blockId}`}
				data-mermaid-preview-scope={blockId}
				className="mt-4.5"
			>
				{header}
				<MermaidFenceIsland
					code={part.text}
					preferDark={preferDark}
					isStreaming={isStreaming || !part.complete}
					openMermaidPreview={openMermaidPreview}
				/>
			</div>
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
