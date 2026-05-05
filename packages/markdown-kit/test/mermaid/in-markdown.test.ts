import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MARKDOWN_MERMAID_PLACEHOLDER_HTML } from '../../src/mermaid/markdown-selectors.js';

/** mermaid.run 入参（与真实 API 对齐的最小形状，便于 mock.calls 类型推断） */
type MermaidRunArg = {
	nodes: HTMLElement[];
	suppressErrors?: boolean;
};

const { mockInitialize, mockRun } = vi.hoisted(() => {
	const mockInitialize = vi.fn();
	const mockRun = vi.fn((_arg: MermaidRunArg) => Promise.resolve());
	return { mockInitialize, mockRun };
});

vi.mock('mermaid', () => ({
	default: {
		initialize: mockInitialize,
		run: mockRun,
	},
}));

import { runMermaidInMarkdownRoot } from '../../src/mermaid/in-markdown.js';

describe('runMermaidInMarkdownRoot', () => {
	beforeEach(() => {
		mockInitialize.mockClear();
		mockRun.mockClear();
	});

	it('root 为 null / undefined 时不调用 mermaid', async () => {
		await runMermaidInMarkdownRoot(null);
		await runMermaidInMarkdownRoot(undefined);
		expect(mockRun).not.toHaveBeenCalled();
		expect(mockInitialize).not.toHaveBeenCalled();
	});

	it('无占位节点时不调用 mermaid', async () => {
		const root = document.createElement('div');
		root.innerHTML = '<p>仅正文</p>';
		await runMermaidInMarkdownRoot(root);
		expect(mockRun).not.toHaveBeenCalled();
		expect(mockInitialize).not.toHaveBeenCalled();
	});

	it('存在占位 DOM 时 initialize 并 run', async () => {
		const root = document.createElement('div');
		root.innerHTML = MARKDOWN_MERMAID_PLACEHOLDER_HTML;
		await runMermaidInMarkdownRoot(root, { preferDark: true });
		expect(mockInitialize).toHaveBeenCalledWith(
			expect.objectContaining({
				startOnLoad: false,
				theme: 'dark',
				securityLevel: 'loose',
			}),
		);
		expect(mockRun).toHaveBeenCalledTimes(1);
		const arg = mockRun.mock.calls[0]?.[0];
		expect(arg).toBeDefined();
		expect(arg).toEqual(
			expect.objectContaining({
				nodes: expect.arrayContaining([expect.any(HTMLElement)]),
			}),
		);
		expect(arg!.nodes.length).toBe(1);
		expect(arg!.nodes[0]?.classList.contains('mermaid')).toBe(true);
	});

	it('suppressErrors 透传给 mermaid.run', async () => {
		const root = document.createElement('div');
		root.innerHTML = MARKDOWN_MERMAID_PLACEHOLDER_HTML;
		await runMermaidInMarkdownRoot(root, {
			preferDark: false,
			suppressErrors: true,
		});
		expect(mockRun).toHaveBeenCalledWith(
			expect.objectContaining({ suppressErrors: true }),
		);
	});
});
