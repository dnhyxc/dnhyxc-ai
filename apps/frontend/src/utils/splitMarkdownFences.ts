/**
 * 按顶格代码围栏拆分 Markdown，将 mermaid 与其它内容分离。
 * 用于聊天流式：Mermaid 单独 React 岛渲染，避免整段 dangerouslySetInnerHTML 冲掉已生成的 SVG。
 *
 * 闭合围栏须按行匹配（与 markdownFenceLineParser 一致），禁止对正文用 indexOf('```')，
 * 否则注释/JSDoc 中的 ```mermaid 等会误当成围栏结束。
 */

import { splitMarkdownFencedBlocks } from '@/utils/markdownFenceLineParser';

export type MarkdownFencePart =
	| { type: 'markdown'; text: string }
	| { type: 'mermaid'; text: string; complete: boolean };

function coalesceMarkdownParts(
	parts: MarkdownFencePart[],
): MarkdownFencePart[] {
	const out: MarkdownFencePart[] = [];
	for (const p of parts) {
		if (p.type === 'markdown' && p.text === '') continue;
		const last = out[out.length - 1];
		if (p.type === 'markdown' && last?.type === 'markdown') {
			last.text += p.text;
		} else {
			out.push(
				p.type === 'markdown' ? { type: 'markdown', text: p.text } : { ...p },
			);
		}
	}
	return out;
}

/**
 * 扫描 ```lang 围栏；mermaid 且未闭合时 `complete: false`（流式尾部）。
 */
export function splitMarkdownByCodeFences(source: string): MarkdownFencePart[] {
	const normalized = source.replace(/\r\n/g, '\n');
	const segments = splitMarkdownFencedBlocks(normalized);
	const out: MarkdownFencePart[] = [];
	for (const seg of segments) {
		if (!seg.fenced) {
			if (seg.text !== '') out.push({ type: 'markdown', text: seg.text });
			continue;
		}
		const lines = seg.text.split('\n');
		const firstLine = lines[0] ?? '';
		const openMatch = /^(\s*)(`{3,})([^`]*)$/.exec(firstLine.trimEnd());
		const lang = (openMatch?.[3] ?? '').trim().toLowerCase();
		const body =
			seg.complete && lines.length >= 2
				? lines.slice(1, -1).join('\n')
				: lines.slice(1).join('\n');
		if (lang === 'mermaid') {
			out.push({ type: 'mermaid', text: body, complete: seg.complete });
		} else {
			out.push({ type: 'markdown', text: seg.text });
		}
	}
	if (out.length === 0 && source) {
		out.push({ type: 'markdown', text: normalized });
	}
	return coalesceMarkdownParts(out);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** 未闭合 mermaid 围栏：纯代码预览（不跑 Mermaid，避免语法不完整报错与整页重绘） */
export function mermaidStreamingFallbackHtml(code: string): string {
	const esc = escapeHtml(code);
	return `<div class="markdown-body"><pre class="chat-md-mermaid-streaming"><code class="language-mermaid">${esc}</code></pre></div>`;
}
