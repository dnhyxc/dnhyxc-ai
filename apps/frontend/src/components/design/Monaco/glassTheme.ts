import type { Monaco } from '@monaco-editor/react';

/**
 * 继承内置主题语法高亮，仅把编辑区相关层改为透明，透出外层 bg-theme/5。
 * 粘性滚动条背景勿在此写 var()/color-mix：Monaco defineTheme 解析失败易偏色；
 * 由 `index.css` 中 `--vscode-editorStickyScroll-*` 与 `.sticky-widget` 覆盖为 `--theme-background`。
 */
const GLASS_CHROME: Record<string, string> = {
	'editor.background': '#00000000',
	'editorGutter.background': '#00000000',
	'minimap.background': '#00000000',
	'editorOverviewRuler.background': '#00000000',
	'editorStickyScroll.background': '#00000000',
	'editorStickyScrollHover.background': '#00000000',
};

export const GLASS_THEME_BY_UI: Record<'vs' | 'vs-dark' | 'hc-black', string> =
	{
		vs: 'dnhyxc-glass-vs',
		'vs-dark': 'dnhyxc-glass-vs-dark',
		'hc-black': 'dnhyxc-glass-hc-black',
	};

/** 在 beforeMount 中注册，可重复调用（defineTheme 覆盖同名） */
export function registerMonacoGlassThemes(monaco: Monaco) {
	const pairs: ReadonlyArray<[string, 'vs' | 'vs-dark' | 'hc-black']> = [
		[GLASS_THEME_BY_UI.vs, 'vs'],
		[GLASS_THEME_BY_UI['vs-dark'], 'vs-dark'],
		[GLASS_THEME_BY_UI['hc-black'], 'hc-black'],
	];
	for (const [id, base] of pairs) {
		monaco.editor.defineTheme(id, {
			base,
			inherit: true,
			rules: [],
			colors: GLASS_CHROME,
		});
	}
}
