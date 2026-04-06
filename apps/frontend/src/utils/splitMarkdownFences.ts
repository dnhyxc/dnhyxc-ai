/**
 * 按顶格代码围栏拆分 Markdown，将 mermaid 与其它内容分离。
 * 用于聊天流式：Mermaid 单独 React 岛渲染，避免整段 dangerouslySetInnerHTML 冲掉已生成的 SVG。
 */

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
	const out: MarkdownFencePart[] = [];
	let i = 0;
	const n = source.length;

	while (i < n) {
		const fenceStart = source.indexOf('```', i);
		if (fenceStart === -1) {
			const tail = source.slice(i);
			if (tail) out.push({ type: 'markdown', text: tail });
			break;
		}
		if (fenceStart > i) {
			out.push({ type: 'markdown', text: source.slice(i, fenceStart) });
		}
		const langEnd = source.indexOf('\n', fenceStart + 3);
		if (langEnd === -1) {
			out.push({ type: 'markdown', text: source.slice(fenceStart) });
			break;
		}
		const lang = source
			.slice(fenceStart + 3, langEnd)
			.trim()
			.toLowerCase();
		const bodyStart = langEnd + 1;
		const closeIdx = source.indexOf('```', bodyStart);
		if (closeIdx === -1) {
			if (lang === 'mermaid') {
				out.push({
					type: 'mermaid',
					text: source.slice(bodyStart),
					complete: false,
				});
			} else {
				out.push({ type: 'markdown', text: source.slice(fenceStart) });
			}
			break;
		}
		const body = source.slice(bodyStart, closeIdx);
		if (lang === 'mermaid') {
			out.push({ type: 'mermaid', text: body, complete: true });
		} else {
			out.push({
				type: 'markdown',
				text: source.slice(fenceStart, closeIdx + 3),
			});
		}
		i = closeIdx + 3;
	}

	if (out.length === 0 && source) {
		out.push({ type: 'markdown', text: source });
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
