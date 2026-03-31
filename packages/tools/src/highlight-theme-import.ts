import type { HighlightJsThemeId } from './generated/highlight-js-theme-ids.js';
import { highlightJsThemes } from './styles.js';

/**
 * 将主题 id（与 highlightJsThemes 的键一致，如 `github-dark`、`atom-one-dark`、`base16/zenburn`）
 * 转为可在源码中用于静态/动态 import 的包说明符（package specifier）。
 *
 * 示例：`resolveHighlightJsThemeSpecifier('atom-one-dark')`
 * → `@dnhyxc-ai/tools/styles/hljs/atom-one-dark.min.css`
 */
export function resolveHighlightJsThemeSpecifier(
	themeId: HighlightJsThemeId,
): string {
	const rel = (highlightJsThemes as Readonly<Record<string, string>>)[themeId];
	if (!rel) {
		throw new Error(
			`未知的 highlight.js 主题 id: "${themeId}"，请对照包导出的 highlightJsThemeIds。`,
		);
	}
	return `@dnhyxc-ai/tools/${rel.replace(/^\.\//, '')}`;
}
