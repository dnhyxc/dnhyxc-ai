/**
 * 单块 ```mermaid 围栏：独立 DOM 岛。
 *
 * 关键目标：流式中边输出边出图，但 **不闪烁**。
 * 做法：每次更新都在 **脱离真实 DOM 的临时节点**上跑 Mermaid（`runMermaidInMarkdownRoot`），
 * 只有当临时节点里成功生成 `<svg>` 时，才把 SVG 拷贝到真实节点；失败则保留上一帧。
 */

import { normalizeMermaidFenceBody } from '@dnhyxc-ai/tools';
import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import { memo, useLayoutEffect, useRef } from 'react';
import { useMermaidDiagramClickPreview } from '@/hooks/useMermaidImagePreview';
import { cn } from '@/lib/utils';

const STREAMING_RENDER_THROTTLE_MS = 200;

let mermaidStageRoot: HTMLElement | null = null;

function ensureMermaidStageRoot(): HTMLElement | null {
	if (typeof document === 'undefined') return null;
	if (mermaidStageRoot && document.body.contains(mermaidStageRoot)) {
		return mermaidStageRoot;
	}
	const el = document.createElement('div');
	el.setAttribute('data-mermaid-stage-root', '1');
	// 离屏 + 不占空间：给 Mermaid 一个“在 DOM 中”的渲染上下文，但不影响布局与可见性
	el.style.position = 'fixed';
	el.style.left = '-99999px';
	el.style.top = '0';
	el.style.width = '1px';
	el.style.height = '1px';
	el.style.overflow = 'hidden';
	el.style.pointerEvents = 'none';
	el.style.visibility = 'hidden';
	document.body.appendChild(el);
	mermaidStageRoot = el;
	return el;
}

export type MermaidFenceIslandProps = {
	code: string;
	preferDark: boolean;
	/** 流式中间态：节流渲染，且失败不回退成纯文本，避免闪烁 */
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
	const genRef = useRef(0); // 递增：仅提交最新一次渲染结果
	const lastRunAtRef = useRef(0);
	const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasEverRenderedRef = useRef(false);
	const lastCommittedSvgRef = useRef<string>('');

	const previewEnabled = Boolean(openMermaidPreview);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		// 壳子只建一次：后续仅更新 .mermaid 的内容
		let wrap = host.querySelector(
			'.markdown-mermaid-wrap[data-mermaid="1"]',
		) as HTMLElement | null;
		if (!wrap) {
			host.innerHTML =
				'<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid"></div></div>';
			wrap = host.querySelector(
				'.markdown-mermaid-wrap[data-mermaid="1"]',
			) as HTMLElement | null;
		}
		const inner = wrap?.querySelector('.mermaid') as HTMLElement | null;
		if (!wrap || !inner) return;

		const dsl = normalizeMermaidFenceBody(code);
		const runId = ++genRef.current;

		const flushTimer = () => {
			if (throttleTimerRef.current) {
				clearTimeout(throttleTimerRef.current);
				throttleTimerRef.current = null;
			}
		};

		const commitSvgIfOk = async () => {
			// 只在最新一次渲染请求仍有效时提交
			if (runId !== genRef.current) return;
			const stageRoot = ensureMermaidStageRoot();
			if (!stageRoot) return;

			const stageHost = document.createElement('div');
			stageHost.innerHTML =
				'<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid"></div></div>';
			const stageInner = stageHost.querySelector(
				'.mermaid',
			) as HTMLElement | null;
			if (!stageInner) return;

			stageInner.textContent = dsl;
			stageRoot.appendChild(stageHost);
			try {
				await runMermaidInMarkdownRoot(stageHost, {
					preferDark,
					suppressErrors: isStreaming,
				});
			} finally {
				stageHost.remove();
			}

			if (runId !== genRef.current) return;
			const svg = stageInner.querySelector('svg');
			const looksLikeErrorSvg = (node: SVGElement | null): boolean => {
				if (!node) return true;
				const t = (node.textContent || '').toLowerCase();
				if (t.includes('syntax error') || t.includes('parse error'))
					return true;
				const aria = (node.getAttribute('aria-label') || '').toLowerCase();
				if (aria.includes('syntax error') || aria.includes('parse error'))
					return true;
				return false;
			};
			if (!svg || looksLikeErrorSvg(svg)) {
				// Mermaid 有时会产出“错误提示 SVG”（不是 throw）：这会在流式过程中闪烁错误气泡。
				// 这里视为失败：保留上一帧 SVG；若从未成功过则显示 DSL 文本兜底。
				if (!hasEverRenderedRef.current) inner.textContent = dsl;
				return;
			}

			const nextSvgHtml = stageInner.innerHTML;
			if (nextSvgHtml === lastCommittedSvgRef.current) {
				return;
			}
			lastCommittedSvgRef.current = nextSvgHtml;

			/**
			 * 不使用 crossfade：Mermaid SVG 内存在大量 `id` 与 `url(#id)` 引用；
			 * 若同一时刻在同一 DOM 子树内保留两份 SVG（哪怕透明），会发生重复 id 冲突，
			 * 导致 marker/clipPath/filter 引用错位，从而出现“渲染出错”。
			 *
			 * 这里采用“离屏生成 + 成功才提交 + 单次原子替换”：
			 * - 永远只让一份 SVG 存在于真实 DOM 中
			 * - 通过节流与相同 SVG 跳过来降低更新频率，减少可感知闪动
			 */
			inner.innerHTML = nextSvgHtml;
			hasEverRenderedRef.current = true;
		};

		const schedule = () => {
			flushTimer();
			const now = Date.now();
			if (!isStreaming) {
				lastRunAtRef.current = now;
				void commitSvgIfOk();
				return;
			}

			if (lastRunAtRef.current === 0) {
				lastRunAtRef.current = now;
				void commitSvgIfOk();
				return;
			}

			const since = now - lastRunAtRef.current;
			if (since >= STREAMING_RENDER_THROTTLE_MS) {
				lastRunAtRef.current = now;
				void commitSvgIfOk();
				return;
			}

			throttleTimerRef.current = setTimeout(() => {
				throttleTimerRef.current = null;
				lastRunAtRef.current = Date.now();
				void commitSvgIfOk();
			}, STREAMING_RENDER_THROTTLE_MS - since);
		};

		// 主题切换或停流：立即刷新一帧
		if (!isStreaming) {
			lastRunAtRef.current = 0;
		}
		schedule();

		return () => flushTimer();
	}, [code, preferDark, isStreaming]);

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
