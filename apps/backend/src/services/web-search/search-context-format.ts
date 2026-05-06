import type { WebSearchOrganicItem } from './web-search.types';

/** Markdown 链接 destination：含空白、尖括号或圆括号时用尖括号包裹并转义 <>，避免破坏解析 */
export function wrapMarkdownLinkDestination(url: string): string {
	const t = url.trim();
	if (!t) {
		return t;
	}
	if (/[\s<>()]/.test(t)) {
		return `<${t.replace(/</g, '%3C').replace(/>/g, '%3E')}>`;
	}
	return t;
}

/**
 * 将 organic 列表格式化为与历史 Serper 注入块一致的结构（引用规则相同，便于前端 organic 角标）。
 * @param sourceLine 首行来源说明，例如「Serper（Google 搜索结果 SERP，即搜索引擎结果页）」
 * @param organic 检索条目
 * @param preamble 可选：插在「参考资料」前的额外段落（如 Tavily 的 answer 摘要）
 */
export function buildWebSearchReferencePromptAppendix(
	sourceLine: string,
	organic: WebSearchOrganicItem[],
	preamble?: string | null,
): string {
	const blocks = organic.map((item, i) => {
		const snippet = item.snippet ?? '';
		const n = i + 1;
		const mdDest = wrapMarkdownLinkDestination(item.link);
		return `${n}. **${item.title}**\n   URL: ${item.link}\n   摘要: ${snippet}\n   引用示例（正文须使用此 Markdown 链接形式）: [${n}](${mdDest})`;
	});

	const extra = preamble?.trim() ? `${preamble.trim()}\n\n` : '';

	return (
		'\n\n---\n' +
		extra +
		`**以下为通过 ${sourceLine} 获取的参考资料**。回答时请结合这些内容；与问题无关的可忽略。\n\n` +
		'**引用格式（须严格遵守）**：\n' +
		'1. 引用第 n 条资料时，**必须**使用 **Markdown 链接** `[n](URL)`，其中 URL 与对应条目的「URL:」行**逐字符一致**（含特殊字符时与「引用示例」相同，可能为尖括号包裹 `<...>`）。\n' +
		'2. **禁止**只写半角方括号序号如 `[n]`（后接句号、空格或句末等），也禁止写脚注式上标；那不是有效 Markdown 链接，引用会失效。\n' +
		'3. 或使用全角序号 **【n】**。\n' +
		'系统会将合规引用转为带 `target="_blank"`、`rel="noopener noreferrer"`、`data-organic-cite`、`style="cursor: pointer;"`、`class="__md-search-organic__"` 的可点击样式。\n\n' +
		blocks.join('\n\n') +
		'\n---\n'
	);
}
