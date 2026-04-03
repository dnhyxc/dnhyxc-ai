/** 拉丁等宽在前，中文回退在后，保证 IME 合成与正文用字一致，减轻中文输入重影 */
const EDITOR_FONT_STACK =
	'"Fira Code", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "SF Mono", Monaco, Menlo, Consolas, monospace';

export const options: any = {
	minimap: { enabled: false },
	fontSize: 14,
	lineHeight: 22,
	fontFamily: EDITOR_FONT_STACK,
	// 连字会干扰 IME 合成区间测量，易与拼音/汉字叠画
	fontLigatures: false,
	// 关闭等宽快速路径，避免中日文与西文字宽混排时测量偏差
	disableMonospaceOptimizations: true,
	lineNumbers: 'on' as const,
	wordWrap: 'on' as const,
	colorDecorators: true,
	scrollBeyondLastLine: false,
	automaticLayout: true,
	padding: { top: 10, bottom: 10 },
	quickSuggestions: false,
	suggestOnTriggerCharacters: false,
	tabSize: 2,
	folding: true,
	foldingHighlight: true,
	foldingStrategy: 'indentation' as const,
	wordBasedSuggestions: 'allDocuments' as const,
	parameterHints: { enabled: false },
	snippetSuggestions: 'inline' as const,
	cursorBlinking: 'smooth' as const,
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
};
