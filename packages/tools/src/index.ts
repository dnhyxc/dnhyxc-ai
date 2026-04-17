export type { HighlightJsThemeId } from './generated/highlight-js-theme-ids.js';
export type { ApplyHighlightJsThemeOptions } from './highlight/inject-theme.js';
export {
	applyHighlightJsTheme,
	clearAppliedHighlightJsTheme,
} from './highlight/inject-theme.js';
export {
	defaultHighlightJsThemeId,
	highlightJsThemeIds,
	highlightJsThemes,
	styleContents,
	styles,
	styleUrls,
} from './highlight/styles.js';
// 样式导出（含 highlight.js 多主题映射，见 docs/tools.md）
export { resolveHighlightJsThemeSpecifier } from './highlight/theme-import.js';
export type {
	BindMarkdownCodeFenceActionsOptions,
	MarkdownCodeFenceAction,
	MarkdownCodeFenceActionPayload,
	MarkdownCodeFenceCopyFeedbackOptions,
	MarkdownCodeFenceDownloadTask,
	MarkdownCodeFenceInfo,
	MarkdownCodeFenceTextInit,
} from './markdown/code-fence-actions.js';
export {
	bindMarkdownCodeFenceActions,
	copyMarkdownCodeFence,
	createMarkdownCodeFenceInfo,
	downloadMarkdownCodeFenceWith,
	getMarkdownCodeFenceInfo,
	getMarkdownCodeFencePlainText,
	markdownCodeFenceFileExtension,
	resolveMarkdownCodeFenceActionPayload,
	showMarkdownCodeFenceCopiedFeedback,
} from './markdown/code-fence-actions.js';
export {
	MARKDOWN_CODE_FENCE_ACTION_BUTTON_SELECTOR,
	MARKDOWN_CODE_FENCE_BLOCK_ROOT_ATTR,
	MARKDOWN_CODE_FENCE_BLOCK_ROOT_SELECTOR,
	MARKDOWN_CODE_FENCE_BLOCK_WRAPPER_CLASS,
	MARKDOWN_CODE_FENCE_DATA_ACTION_ATTR,
	MARKDOWN_CODE_FENCE_DATA_BUTTON_LANG_ATTR,
	MARKDOWN_CODE_FENCE_DATA_COPY_STATE_ATTR,
	MARKDOWN_CODE_FENCE_SOURCE_CODE_SELECTOR,
	MARKDOWN_CODE_FENCE_TOOLBAR_ACTIONS_CLASS,
	MARKDOWN_CODE_FENCE_TOOLBAR_BTN_CLASS,
	MARKDOWN_CODE_FENCE_TOOLBAR_CLASS,
	MARKDOWN_CODE_FENCE_TOOLBAR_FLOAT_REPLACED_CLASS,
	MARKDOWN_CODE_FENCE_TOOLBAR_LANG_CLASS,
	MARKDOWN_CODE_FENCE_TOOLBAR_LANG_SELECTOR,
	MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR,
	MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_CLASS,
	MARKDOWN_CODE_FENCE_TOOLBAR_SLOT_SELECTOR,
	queryMarkdownCodeFenceBlockRoots,
} from './markdown/code-fence-dom.js';
export type {
	MarkdownMermaidSplitPart,
	MarkdownParserOptions,
	MarkdownRenderEnv,
} from './markdown/parser.js';
export {
	default as MarkdownParser,
	normalizeMermaidFenceBody,
} from './markdown/parser.js';
export {
	closestMermaidMarkdownWrap,
	MARKDOWN_MERMAID_PLACEHOLDER_HTML,
	MARKDOWN_MERMAID_TAILWIND_CURSOR_ZOOM_IN_CLASS,
	MARKDOWN_MERMAID_WRAP_CLASS,
	MARKDOWN_MERMAID_WRAP_DATA_ATTR,
	MARKDOWN_MERMAID_WRAP_DATA_VALUE,
	MARKDOWN_MERMAID_WRAP_SELECTOR,
	MERMAID_ENTRY_CLASS,
	MERMAID_ENTRY_SELECTOR,
	MERMAID_MARKDOWN_ENTRY_SELECTOR,
	MERMAID_MARKDOWN_SVG_SELECTOR,
	queryFirstMermaidMarkdownEntryNode,
	queryFirstMermaidMarkdownWrap,
	queryMermaidMarkdownEntryNodes,
} from './mermaid/markdown-selectors.js';
