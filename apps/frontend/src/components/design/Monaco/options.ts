/** 拉丁等宽在前，中文回退在后，保证 IME 合成与正文用字一致，减轻中文输入重影 */
const EDITOR_FONT_STACK =
	'"Fira Code", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "SF Mono", Monaco, Menlo, Consolas, monospace';

export const MONACO_TAB_SIZE = 2;

/** Markdown 编辑区：折行上限（列），与 `wordWrap: bounded` 配合；窄于此时按视口宽度折行 */
export const MARKDOWN_EDITOR_WORD_WRAP_COLUMN = 120;

export const options: any = {
	minimap: { enabled: false },
	fontSize: 14,
	lineHeight: 22,
	fontFamily: EDITOR_FONT_STACK,
	lineNumbers: 'on' as const,
	wordWrap: 'on' as const,
	scrollBeyondLastLine: false,
	automaticLayout: true,
	padding: { top: 10, bottom: 10 },
	quickSuggestions: false,
	suggestOnTriggerCharacters: false,
	tabSize: 2,
	indentSize: 2,
	foldingStrategy: 'indentation' as const,
	wordBasedSuggestions: 'allDocuments' as const,
	parameterHints: { enabled: false },
	snippetSuggestions: 'inline' as const,
	cursorSmoothCaretAnimation: 'off' as const,
	renderLineHighlight: 'none' as const,
	hideCursorInOverviewRuler: true,
	overviewRulerBorder: false,
	contextmenu: false,
	scrollbar: {
		vertical: 'visible' as const,
		horizontal: 'visible' as const,
		verticalScrollbarSize: 8,
		horizontalScrollbarSize: 8,
	},
	// 连字会干扰 IME 合成区间测量，易与拼音/汉字叠画
	// fontLigatures: false,
	// 关闭等宽快速路径，避免中日文与西文字宽混排时测量偏差
	// disableMonospaceOptimizations: true,
	// colorDecorators: true,
	// folding: true,
	// foldingHighlight: true,
	// cursorBlinking: 'smooth' as const,
	fontLigatures: false,
	// 与 base 同为 true：关等宽快速路径，利于 IME；列对齐问题见文档 §4.2 B / §4.4
	disableMonospaceOptimizations: true,
	colorDecorators: false,
	folding: false,
	foldingHighlight: false,
	stickyScroll: { enabled: false },
	glyphMargin: false,
	accessibilitySupport: 'off' as const,
	cursorBlinking: 'solid' as const,
};
