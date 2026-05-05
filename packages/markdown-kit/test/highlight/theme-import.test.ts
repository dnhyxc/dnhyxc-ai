import { describe, expect, it } from 'vitest';
import type { HighlightJsThemeId } from '../../src/generated/highlight-js-theme-ids.js';
import { resolveHighlightJsThemeSpecifier } from '../../src/highlight/theme-import.js';

describe('resolveHighlightJsThemeSpecifier', () => {
	it('将已知主题 id 转为包内样式说明符', () => {
		const spec = resolveHighlightJsThemeSpecifier('github-dark');
		expect(spec).toBe(
			'@dnhyxc-ai/markdown-kit/styles/hljs/github-dark.min.css',
		);
	});

	it('对未知主题 id 抛出明确错误', () => {
		expect(() =>
			resolveHighlightJsThemeSpecifier(
				'__not_a_real_theme__' as HighlightJsThemeId,
			),
		).toThrow(/未知的 highlight.js 主题 id/);
	});
});
