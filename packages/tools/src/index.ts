export type { HighlightJsThemeId } from './generated/highlight-js-theme-ids.js';
// 样式导出（含 highlight.js 多主题映射，见 docs/tools.md）
export { resolveHighlightJsThemeSpecifier } from './highlight-theme-import.js';
export type { ApplyHighlightJsThemeOptions } from './inject-highlight-theme.js';
export {
	applyHighlightJsTheme,
	clearAppliedHighlightJsTheme,
} from './inject-highlight-theme.js';
export type { MarkdownParserOptions } from './markdown-parser.js';
export { default as MarkdownParser } from './markdown-parser.js';
export {
	defaultHighlightJsThemeId,
	highlightJsThemeIds,
	highlightJsThemes,
	styleContents,
	styles,
	styleUrls,
} from './styles.js';
