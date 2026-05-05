import { describe, expect, it } from 'vitest';
import {
	closestMermaidMarkdownWrap,
	MARKDOWN_MERMAID_PLACEHOLDER_HTML,
	MARKDOWN_MERMAID_WRAP_CLASS,
	MARKDOWN_MERMAID_WRAP_DATA_ATTR,
	MARKDOWN_MERMAID_WRAP_DATA_VALUE,
	MERMAID_ENTRY_CLASS,
	MERMAID_MARKDOWN_ENTRY_SELECTOR,
	MERMAID_MARKDOWN_SVG_SELECTOR,
	queryFirstMermaidMarkdownEntryNode,
	queryFirstMermaidMarkdownWrap,
	queryMermaidMarkdownEntryNodes,
} from '../../src/mermaid/markdown-selectors.js';

describe('markdown-selectors 契约常量', () => {
	it('包裹选择器包含 data-mermaid 约束，避免误命中', () => {
		expect(MERMAID_MARKDOWN_ENTRY_SELECTOR).toContain(
			`[${MARKDOWN_MERMAID_WRAP_DATA_ATTR}="${MARKDOWN_MERMAID_WRAP_DATA_VALUE}"]`,
		);
		expect(MERMAID_MARKDOWN_ENTRY_SELECTOR).toContain(
			`.${MARKDOWN_MERMAID_WRAP_CLASS}`,
		);
	});

	it('SVG 选择器在入口选择器基础上追加 svg', () => {
		expect(MERMAID_MARKDOWN_SVG_SELECTOR).toContain('svg');
		expect(
			MERMAID_MARKDOWN_SVG_SELECTOR.startsWith('.markdown-mermaid-wrap'),
		).toBe(true);
	});

	it('占位 HTML 与选择器 class / data 属性一致', () => {
		expect(MARKDOWN_MERMAID_PLACEHOLDER_HTML).toContain(
			`class="${MARKDOWN_MERMAID_WRAP_CLASS}"`,
		);
		expect(MARKDOWN_MERMAID_PLACEHOLDER_HTML).toContain(
			`${MARKDOWN_MERMAID_WRAP_DATA_ATTR}="${MARKDOWN_MERMAID_WRAP_DATA_VALUE}"`,
		);
		expect(MARKDOWN_MERMAID_PLACEHOLDER_HTML).toContain(
			`class="${MERMAID_ENTRY_CLASS}"`,
		);
	});
});

describe('markdown-selectors 查询与 closest', () => {
	function mountPlaceholder(): HTMLDivElement {
		const root = document.createElement('div');
		root.innerHTML = MARKDOWN_MERMAID_PLACEHOLDER_HTML;
		return root;
	}

	it('queryMermaidMarkdownEntryNodes 命中占位内的 .mermaid', () => {
		const root = mountPlaceholder();
		const nodes = queryMermaidMarkdownEntryNodes(root);
		expect(nodes.length).toBe(1);
		expect(nodes[0]?.classList.contains(MERMAID_ENTRY_CLASS)).toBe(true);
	});

	it('queryFirstMermaidMarkdownEntryNode / Wrap 与占位结构一致', () => {
		const root = mountPlaceholder();
		const entry = queryFirstMermaidMarkdownEntryNode(root);
		const wrap = queryFirstMermaidMarkdownWrap(root);
		expect(entry).toBeTruthy();
		expect(wrap).toBeTruthy();
		expect(wrap?.contains(entry!)).toBe(true);
	});

	it('closestMermaidMarkdownWrap 从子节点向上找到包裹层', () => {
		const root = mountPlaceholder();
		const inner = root.querySelector(`.${MERMAID_ENTRY_CLASS}`);
		expect(inner).toBeTruthy();
		const wrap = closestMermaidMarkdownWrap(inner);
		expect(wrap?.classList.contains(MARKDOWN_MERMAID_WRAP_CLASS)).toBe(true);
		expect(wrap?.getAttribute(MARKDOWN_MERMAID_WRAP_DATA_ATTR)).toBe(
			MARKDOWN_MERMAID_WRAP_DATA_VALUE,
		);
	});

	it('closestMermaidMarkdownWrap 对 null 返回 null', () => {
		expect(closestMermaidMarkdownWrap(null)).toBeNull();
	});
});
