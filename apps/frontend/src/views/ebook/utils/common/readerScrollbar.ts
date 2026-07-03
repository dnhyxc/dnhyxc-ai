/** 阅读区原生滚动条美化（细条 + 主题色，与 EPUB 连续滚动一致） */
export const READER_NATIVE_SCROLLBAR = [
	'[scrollbar-width:thin]',
	'[scrollbar-color:color-mix(in_oklch,var(--theme-border)_60%,transparent)_transparent]',
	'[&::-webkit-scrollbar]:w-2',
	'[&::-webkit-scrollbar-track]:bg-transparent',
	'[&::-webkit-scrollbar-thumb]:rounded-full',
	'[&::-webkit-scrollbar-thumb]:bg-theme-border/60',
	'hover:[&::-webkit-scrollbar-thumb]:bg-theme-border',
] as const;

/** epub.js 滚动发生在内部 .epub-container 上 */
export const READER_NATIVE_SCROLLBAR_EPUB_CONTAINER = [
	'[&_.epub-container]:[overflow-anchor:none]',
	'[&_.epub-view]:[overflow-anchor:none]',
	'[&_.epub-container]:[scrollbar-width:thin]',
	'[&_.epub-container]:[scrollbar-color:color-mix(in_oklch,var(--theme-border)_60%,transparent)_transparent]',
	'[&_.epub-container::-webkit-scrollbar]:w-2',
	'[&_.epub-container::-webkit-scrollbar-track]:bg-transparent',
	'[&_.epub-container::-webkit-scrollbar-thumb]:rounded-full',
	'[&_.epub-container::-webkit-scrollbar-thumb]:bg-theme-border/60',
	'hover:[&_.epub-container::-webkit-scrollbar-thumb]:bg-theme-border',
] as const;
