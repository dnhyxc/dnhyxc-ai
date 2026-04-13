/**
 * 按顶格代码围栏拆分 Markdown，将 mermaid 与其它内容分离。
 * 用于聊天流式：Mermaid 单独 React 岛渲染，避免整段 dangerouslySetInnerHTML 冲掉已生成的 SVG。
 *
 * 闭合围栏须按行匹配（与 markdownFenceLineParser 一致），禁止对正文用 indexOf('```')，
 * 否则注释/JSDoc 中的 ```mermaid 等会误当成围栏结束。
 */

import type {
	MarkdownMermaidSplitPart,
	MarkdownParser,
} from '@dnhyxc-ai/tools';
import {
	fenceClosingIndentMatchesOpen,
	isPlausibleMarkdownFenceIndent,
	splitMarkdownFencedBlocks,
} from '@/utils/markdownFenceLineParser';

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

/**
 * splitOpenMermaidTail 的作用是：
 *
 * 在给定的 markdown 文本中，检测是否存在“未闭合的 mermaid 代码块”（即以 ```mermaid 开头却没有相应结束围栏的片段），如果存在就将其拆分成前缀 prefix（所有未进围栏之前的内容）和 body（未闭合 mermaid 围栏之后至结尾所有内容），以及其起始的行号 openLine。
 *
 * 工作原理详解如下：
 *
 * 1. 首先规范化输入，将所有行结尾统一为 '\n'。
 * 2. 逐行遍历，查找以 ```（数量>=3的反引号）标记且指定语言为 mermaid 的围栏起始行，同时要求缩进是符合 markdown 代码围栏规范的。
 * 3. 如果找到 mermaid 围栏开头，向下查找是否有闭合对应数量反引号的围栏结束（且缩进与开头一致，严格要求闭合）。
 * 4. 如果找到了闭合（正常 ```mermaid ... ```），跳过该块，继续查找下一个。
 * 5. 如果没找到闭合（即 mermaid 围栏未闭合），则：
 *    - prefix：取所有该围栏开头（不含）之前的全部内容（并保留换行），确保 markdown 连续性不被破坏。
 *    - body：取围栏内内容（即 mermaid 围栏开头下一行起，直至全文结束），即为未闭合的 mermaid 代码段。
 *    - openLine：记录未闭合 mermaid 围栏开头的行号。
 *    - 立即返回这三个信息的对象。
 * 6. 若找遍全文都没检测到未闭合的 mermaid 围栏，则返回 null。
 *
 * 这种分析手段主要用于流式渲染场景：可以在 mermaid 代码还没闭合时，拆出流式片段单独显示与处理，避免因围栏未闭合而导致整体 markdown 解析混乱。
 */
export function splitOpenMermaidTail(
	source: string,
): { prefix: string; body: string; openLine: number } | null {
	const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n');

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		// 尝试匹配形如 ```mermaid 的代码围栏起始行
		const openMatch = /^(\s*)(`{3,})([^`]*)$/.exec(line.trimEnd());
		if (!openMatch) continue;
		const openIndent = openMatch[1] ?? '';
		const tickLen = openMatch[2]?.length ?? 3;
		const lang = (openMatch[3] ?? '').trim().split(/\s+/)[0]?.toLowerCase();
		if (!isPlausibleMarkdownFenceIndent(openIndent)) continue;
		if (lang !== 'mermaid') continue;

		// 找到 ```mermaid 后，向下查找是否有对应的围栏结束（闭合）
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
			i = j; // 跳过完整闭合的代码块，继续向后搜寻
			continue;
		}

		// 如果没闭合，则此处为 open tail
		// prefix 需带末尾换行，避免下个 ``` 被错误拼接在 prefix 行尾
		const prefixLines = lines.slice(0, i);
		const prefix = prefixLines.length > 0 ? `${prefixLines.join('\n')}\n` : '';
		const body = lines.slice(i + 1).join('\n');
		return { prefix, body, openLine: i };
	}
	return null;
}

/**
 * 按 mermaid 围栏将 markdown 拆分为多个区块（普通文本/mermaid 块），支持特殊处理尾部“未闭合 mermaid 围栏”。
 *
 * - 若开启 enableOpenTail，则会检测 markdown 尾部是否存在未闭合的 mermaid 围栏块，
 *   并将其提取为独立的 mermaid 片段（通常用于流式渲染阶段，实现未闭合也能实时渲染 mermaid）。
 *   此时返回的 parts 最后一个元素 type='mermaid' 且 complete=false，其余部分正常拆分。
 * - 未开启 enableOpenTail 时，与 parser.splitForMermaidIslands 原始行为一致。
 * - openMermaidIdPrefix 用于为未闭合 mermaid 块生成唯一标识（建议用行号区分）。
 *
 * @param args
 *   - markdown：原始 markdown 字符串内容
 *   - parser：MarkdownParser 实例，用于常规 mermaid 块分割
 *   - enableOpenTail：是否启用尾部未闭合 mermaid 围栏检测（按场景建议开启/关闭）
 *   - openMermaidIdPrefix：未闭合 mermaid 围栏唯一 key 的前缀（后拼 openLine 行号）
 * @returns
 *   - parts：区块分割结果，普通 markdown 段和 mermaid 块聚合（未闭合时最后一块为 mermaid, complete=false）
 *   - openTail：若检测到未闭合 mermaid，描述其内容的对象（prefix, body, openLine），否则为 null
 *   - openMermaidId：未闭合 mermaid 围栏块的唯一 key（`${openMermaidIdPrefix}${openLine}`），否则为 null
 */
export function splitForMermaidIslandsWithOpenTail(args: {
	markdown: string;
	parser: MarkdownParser;
	/**
	 * 是否启用“尾部未闭合 Mermaid 围栏”的探测。
	 * - 聊天：仅流式阶段启用
	 * - Monaco 预览：仅 enableMermaid 时启用
	 */
	enableOpenTail: boolean;
	/** 未闭合 Mermaid 围栏对应的稳定 key 前缀（拼接 openLine） */
	openMermaidIdPrefix: string;
}): {
	parts: MarkdownMermaidSplitPart[];
	openTail: { prefix: string; body: string; openLine: number } | null;
	openMermaidId: string | null;
} {
	const { markdown, parser, enableOpenTail, openMermaidIdPrefix } = args;

	if (!enableOpenTail) {
		return {
			parts: parser.splitForMermaidIslands(markdown),
			openTail: null,
			openMermaidId: null,
		};
	}

	const openTail = splitOpenMermaidTail(markdown);
	if (!openTail) {
		return {
			parts: parser.splitForMermaidIslands(markdown),
			openTail: null,
			openMermaidId: null,
		};
	}

	const headParts = parser.splitForMermaidIslands(openTail.prefix);
	const parts: MarkdownMermaidSplitPart[] = [
		...headParts,
		{ type: 'mermaid', text: openTail.body, complete: false },
	];
	return {
		parts,
		openTail,
		openMermaidId: `${openMermaidIdPrefix}${openTail.openLine}`,
	};
}

export function hashText(s: string): string {
	// 简单稳定 hash（djb2），用于给“同一块 mermaid”生成稳定 id
	let h = 5381;
	for (let i = 0; i < s.length; i++) {
		h = (h * 33) ^ s.charCodeAt(i);
	}
	return (h >>> 0).toString(36);
}
