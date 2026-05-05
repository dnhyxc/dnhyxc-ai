import { renderHook, waitFor } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MARKDOWN_MERMAID_PLACEHOLDER_HTML } from '../../src/mermaid/markdown-selectors.js';

vi.mock('../../src/mermaid/in-markdown.js', () => ({
	runMermaidInMarkdownRoot: vi.fn(() => Promise.resolve()),
}));

import { runMermaidInMarkdownRoot } from '../../src/mermaid/in-markdown.js';
import { useMermaidInMarkdownRoot } from '../../src/react/use-mermaid-in-markdown-root.js';

const runMock = vi.mocked(runMermaidInMarkdownRoot);

describe('useMermaidInMarkdownRoot', () => {
	it('parser.enableMermaid 为 false 时不调用 runMermaidInMarkdownRoot', () => {
		const div = document.createElement('div');
		const rootRef: MutableRefObject<HTMLDivElement | null> = {
			current: div,
		};

		runMock.mockClear();

		renderHook(() =>
			useMermaidInMarkdownRoot({
				rootRef,
				preferDark: false,
				trigger: 1,
				parser: { enableMermaid: false },
			}),
		);

		expect(runMock).not.toHaveBeenCalled();
	});

	it('enableMermaid 为 true 时在布局后调用 runMermaidInMarkdownRoot', async () => {
		const div = document.createElement('div');
		div.innerHTML = MARKDOWN_MERMAID_PLACEHOLDER_HTML;
		const rootRef: MutableRefObject<HTMLDivElement | null> = {
			current: div,
		};

		runMock.mockClear();

		renderHook(() =>
			useMermaidInMarkdownRoot({
				rootRef,
				preferDark: true,
				trigger: 'markdown-v1',
				parser: { enableMermaid: true },
			}),
		);

		await waitFor(() => {
			expect(runMock).toHaveBeenCalled();
		});

		expect(runMock).toHaveBeenCalledWith(
			div,
			expect.objectContaining({
				preferDark: true,
				suppressErrors: false,
			}),
		);
	});
});
