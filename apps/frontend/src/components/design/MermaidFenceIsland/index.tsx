/**
 * 单块 ```mermaid 围栏：独立 DOM 岛。
 *
 * 目标（聊天流式）：
 * - 边输出边渲染 Mermaid（围栏闭合后，或尾部未闭合 mermaid 也可持续尝试出图）
 * - 不闪烁：DSL 半成品时 Mermaid 可能产出“错误提示 SVG”，或频繁替换 SVG 导致视觉抖动
 *
 * 策略：
 * - 在 body 下创建“离屏但可测量”的 stageRoot（opacity:0 + 大尺寸），在其内离屏跑 `runMermaidInMarkdownRoot`
 * - 只有在离屏渲染成功且不是“错误 SVG”时，才提交到真实 DOM（保留上一帧避免闪）
 * - 流式阶段对提交做强合并（节流 + 字符增量阈值 + 最大等待），减少频繁替换 SVG 带来的闪烁感
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
	className?: string;
};

const noopOpenPreview = (_dataUrl: string) => {};

const STREAMING_COMMIT_THROTTLE_MS = 700;
const STREAMING_COMMIT_MAX_WAIT_MS = 1400;
const STREAMING_MIN_CHAR_DELTA_TO_COMMIT = 60;

let mermaidStageRoot: HTMLElement | null = null;

function ensureMermaidStageRoot(): HTMLElement | null {
	if (typeof document === 'undefined') return null;
	if (mermaidStageRoot && document.body.contains(mermaidStageRoot)) {
		return mermaidStageRoot;
	}
	const el = document.createElement('div');
	el.setAttribute('data-mermaid-stage-root', '1');
	// 离屏但可测量：类图/甘特图等会做文本测量，不能用 visibility:hidden + 1px
	el.style.position = 'fixed';
	el.style.left = '-99999px';
	el.style.top = '0';
	el.style.width = '2000px';
	el.style.minHeight = '1200px';
	el.style.overflow = 'visible';
	el.style.pointerEvents = 'none';
	el.style.opacity = '0';
	el.style.zIndex = '-1';
	document.body.appendChild(el);
	mermaidStageRoot = el;
	return el;
}

export const MermaidFenceIsland = memo(function MermaidFenceIsland({
	code,
	preferDark,
	isStreaming = false,
	openMermaidPreview,
	className,
}: MermaidFenceIslandProps) {
	const hostRef = useRef<HTMLDivElement>(null);
	const genRef = useRef(0); // 代数：作废过期渲染
	const isStreamingRef = useRef(isStreaming);
	isStreamingRef.current = isStreaming;
	const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastCommitAtRef = useRef(0);
	const lastCommitAttemptAtRef = useRef(0);
	const lastCommittedSvgRef = useRef<string>('');
	const lastCommittedDslLenRef = useRef(0);
	const hasEverRenderedRef = useRef(false);

	const previewEnabled = Boolean(openMermaidPreview);

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;

		// 真实 DOM：只创建一次 wrap，后续仅替换 .mermaid 内容
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
		const dslLen = dsl.length;
		const runId = ++genRef.current;

		const stageRoot = ensureMermaidStageRoot();
		if (!stageRoot) return;

		const flushTimer = () => {
			if (throttleTimerRef.current) {
				clearTimeout(throttleTimerRef.current);
				throttleTimerRef.current = null;
			}
		};

		const looksLikeErrorSvg = (node: SVGElement | null): boolean => {
			if (!node) return true;
			const t = (node.textContent || '').toLowerCase();
			const aria = (node.getAttribute('aria-label') || '').toLowerCase();
			// 错误图的特征组合：Syntax error in text + mermaid version
			const looksLikeSyntax =
				t.includes('syntax error in text') ||
				aria.includes('syntax error in text');
			const looksLikeMermaidVersion =
				t.includes('mermaid version') || aria.includes('mermaid version');
			return looksLikeSyntax && looksLikeMermaidVersion;
		};

		const commitSvgIfOk = async () => {
			if (runId !== genRef.current) return;

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
					suppressErrors: isStreamingRef.current,
				});
			} finally {
				stageHost.remove();
			}

			if (runId !== genRef.current) return;
			const svg = stageInner.querySelector('svg');
			if (!svg || looksLikeErrorSvg(svg)) {
				// DSL 不完整或语法错误：不提交错误 SVG，保留上一帧避免闪
				if (!hasEverRenderedRef.current) inner.textContent = dsl;
				return;
			}

			const nextSvgHtml = stageInner.innerHTML;
			if (nextSvgHtml === lastCommittedSvgRef.current) return;

			// 原子替换：避免同时存在两份 SVG 导致 id/url(#id) 冲突
			inner.innerHTML = nextSvgHtml;
			lastCommittedSvgRef.current = nextSvgHtml;
			lastCommittedDslLenRef.current = dslLen;
			lastCommitAtRef.current = Date.now();
			hasEverRenderedRef.current = true;
		};

		const schedule = () => {
			flushTimer();

			// 停流：立即刷新一帧最终图
			if (!isStreamingRef.current) {
				lastCommitAttemptAtRef.current = 0;
				void commitSvgIfOk();
				return;
			}

			const now = Date.now();
			const sinceCommit = now - lastCommitAtRef.current;
			const sinceAttempt = now - lastCommitAttemptAtRef.current;
			const delta = dslLen - lastCommittedDslLenRef.current;

			// 规则：
			// - 增量足够大：允许更快刷新
			// - 增量很小：合并到下一次（减少“每几个字符换一次 SVG”的闪烁感）
			// - 最久等待：超过 max wait 必须刷新一次，避免“长时间不更新”
			const shouldCommitNow =
				sinceCommit >= STREAMING_COMMIT_MAX_WAIT_MS ||
				(delta >= STREAMING_MIN_CHAR_DELTA_TO_COMMIT &&
					sinceCommit >= STREAMING_COMMIT_THROTTLE_MS);

			if (shouldCommitNow) {
				lastCommitAttemptAtRef.current = now;
				void commitSvgIfOk();
				return;
			}

			const wait = Math.max(
				40,
				Math.min(
					STREAMING_COMMIT_THROTTLE_MS,
					STREAMING_COMMIT_THROTTLE_MS - Math.min(sinceCommit, sinceAttempt),
				),
			);
			throttleTimerRef.current = setTimeout(() => {
				throttleTimerRef.current = null;
				lastCommitAttemptAtRef.current = Date.now();
				void commitSvgIfOk();
			}, wait);
		};

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
				className,
			)}
		/>
	);
});
