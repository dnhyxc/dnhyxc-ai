import { describe, expect, it } from 'vitest';
import MarkdownParser, {
	type MarkdownMermaidSplitPart,
	normalizeMermaidFenceBody,
} from '../../src/markdown/parser.js';

/** 避免构造时向 document.head 注入样式，测试环境保持纯净 */
const baseParserOptions = {
	injectHighlightTheme: false as const,
};

describe('normalizeMermaidFenceBody', () => {
	it('将 CRLF / 单独 CR 规范为 LF', () => {
		expect(normalizeMermaidFenceBody('a\r\nb\rc')).toBe('a\nb\nc');
	});

	it('为含 / 的未加引号节点标签补双引号', () => {
		expect(normalizeMermaidFenceBody('A[foo/bar]')).toBe('A["foo/bar"]');
	});

	it('跳过梯形 [/.../] 形态', () => {
		expect(normalizeMermaidFenceBody('A[/x/y/]')).toBe('A[/x/y/]');
	});

	it('为含括号或冒号的未加引号节点标签补双引号', () => {
		expect(normalizeMermaidFenceBody('LRU[LRU 淘汰策略 (Max 12)]')).toBe(
			'LRU["LRU 淘汰策略 (Max 12)"]',
		);
		expect(
			normalizeMermaidFenceBody('MAP[Map 存储结构 key: namespace:libraryId]'),
		).toBe('MAP["Map 存储结构 key: namespace:libraryId"]');
	});
});

describe('MarkdownParser', () => {
	it('将 Markdown 包在默认 markdown-body 容器内', () => {
		const parser = new MarkdownParser(baseParserOptions);
		const html = parser.render('# 标题\n\n正文');
		expect(html).toContain('markdown-body');
		expect(html).toContain('<h1');
		expect(html).toContain('标题');
	});

	it('默认不渲染 raw HTML（防 XSS）', () => {
		const parser = new MarkdownParser(baseParserOptions);
		const html = parser.render('<script>evil</script>');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('enableMermaid: false 时 mermaid 围栏按普通代码块输出', () => {
		const parser = new MarkdownParser({
			...baseParserOptions,
			enableMermaid: false,
		});
		const html = parser.render('```mermaid\ngraph TD\n  A-->B\n```');
		expect(html).toContain('<pre>');
		expect(html).not.toContain('markdown-mermaid-wrap');
	});

	it('enableMermaid: true 时 mermaid 围栏输出占位结构', () => {
		const parser = new MarkdownParser({
			...baseParserOptions,
			enableMermaid: true,
		});
		const html = parser.render('```mermaid\ngraph TD\n  A-->B\n```');
		expect(html).toContain('markdown-mermaid-wrap');
		expect(html).toContain('data-mermaid="1"');
	});

	it('enableChatCodeFenceToolbar 为围栏注入工具栏 DOM 契约', () => {
		const parser = new MarkdownParser({
			...baseParserOptions,
			enableChatCodeFenceToolbar: true,
		});
		const html = parser.render('```ts\nconst x = 1\n```');
		expect(html).toContain('data-chat-code-block');
		expect(html).toContain('chat-md-code-toolbar');
		expect(html).toContain('data-chat-code-action="copy"');
	});

	it('enableHeadingSourceLineAttr 为标题写入行号属性', () => {
		const parser = new MarkdownParser({
			...baseParserOptions,
			enableHeadingSourceLineAttr: true,
		});
		const html = parser.render('# 第一行\n\n正文');
		expect(html).toMatch(/data-md-heading-line="1"/);
	});

	it('render 可按次关闭 Mermaid（与实例默认无关）', () => {
		const parser = new MarkdownParser({
			...baseParserOptions,
			enableMermaid: true,
		});
		const on = parser.render('```mermaid\na\n```', { enableMermaid: true });
		const off = parser.render('```mermaid\na\n```', { enableMermaid: false });
		expect(on).toContain('markdown-mermaid-wrap');
		expect(off).not.toContain('markdown-mermaid-wrap');
	});
});

describe('MarkdownParser.splitForMermaidIslands', () => {
	it('无围栏时整篇为单个 markdown 段', () => {
		const parser = new MarkdownParser(baseParserOptions);
		const parts = parser.splitForMermaidIslands('# 仅正文');
		expect(parts).toHaveLength(1);
		const first = parts[0] as MarkdownMermaidSplitPart | undefined;
		expect(first).toMatchObject({
			type: 'markdown',
			lineBase0: 0,
		});
		expect(first?.type).toBe('markdown');
		if (first?.type === 'markdown') {
			expect(first.text).toContain('# 仅正文');
		}
	});

	it('将闭合的 mermaid 围栏拆成独立段', () => {
		const parser = new MarkdownParser(baseParserOptions);
		const src = '前文\n\n```mermaid\ngraph TD\n  A-->B\n```\n\n后文';
		const parts = parser.splitForMermaidIslands(src);
		const types = parts.map((p) => p.type);
		expect(types).toContain('mermaid');
		expect(types).toContain('markdown');
		const mermaid = parts.find(
			(p): p is Extract<MarkdownMermaidSplitPart, { type: 'mermaid' }> =>
				p.type === 'mermaid',
		);
		expect(mermaid).toBeDefined();
		expect(mermaid?.complete).toBe(true);
		expect(mermaid?.text).toContain('graph TD');
	});
});
