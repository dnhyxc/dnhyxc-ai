import type { Rendition } from 'epubjs';
import type { ThemeName } from '@/hooks';

export const EPUB_READER_SETTINGS_STORAGE_KEY = 'dnhyxc_epub_reader_settings';

/** 阅读背景（参考 Kindle / iBooks / 微信读书等主流方案） */
export type EpubReaderBgTheme =
	| 'default'
	| 'paper'
	| 'cream'
	| 'sepia'
	| 'warm'
	| 'green'
	| 'blue'
	| 'gray'
	| 'pink'
	| 'lavender'
	| 'night'
	| 'moon';

/** 文字颜色 */
export type EpubReaderTextColor =
	| 'auto'
	| 'dark'
	| 'softDark'
	| 'brown'
	| 'sepia'
	| 'gray'
	| 'light'
	| 'softLight'
	| 'green'
	| 'blue'
	| 'rose'
	| 'warmGray';

/** EPUB 阅读排版：分页（左右翻页）或连续滚动 */
export type EpubReaderPageFlow = 'paginated' | 'scrolled';

export type EpubReaderSettings = {
	fontSize: number;
	lineHeight: number;
	textColor: EpubReaderTextColor;
	bgTheme: EpubReaderBgTheme;
	pageFlow: EpubReaderPageFlow;
};

export type EpubBgThemeOption = {
	id: EpubReaderBgTheme;
	/** 固定背景色；default 跟随应用主题 */
	bgColor?: string;
};

export type EpubTextColorOption = {
	id: EpubReaderTextColor;
	color?: string;
};

/** 背景色选项（Kindle 白/sepia/薄荷、iBooks 羊皮纸、微信读书护眼系列、夜间模式等） */
export const EPUB_BG_THEME_OPTIONS: EpubBgThemeOption[] = [
	{ id: 'default' },
	{ id: 'paper', bgColor: '#ffffff' },
	{ id: 'moon', bgColor: '#f6f6f6' },
	{ id: 'gray', bgColor: '#e8e8e8' },
	{ id: 'cream', bgColor: '#f8f1e3' },
	{ id: 'warm', bgColor: '#fff8e7' },
	{ id: 'sepia', bgColor: '#d8e9d7' },
	{ id: 'green', bgColor: '#c5e6ce' },
	{ id: 'blue', bgColor: '#e3edf7' },
	{ id: 'pink', bgColor: '#f5e6e0' },
	{ id: 'lavender', bgColor: '#ebe4f5' },
	{ id: 'night', bgColor: '#121212' },
];

/** 文字色选项（数量与背景色一致，便于一一搭配） */
export const EPUB_TEXT_COLOR_OPTIONS: EpubTextColorOption[] = [
	{ id: 'auto' },
	{ id: 'dark', color: '#232323' },
	{ id: 'brown', color: '#5d4332' },
	{ id: 'sepia', color: '#634a2e' },
	{ id: 'softDark', color: '#3d3d3d' },
	{ id: 'green', color: '#3b4c44' },
	{ id: 'blue', color: '#2c3e50' },
	{ id: 'gray', color: '#5c5c5c' },
	{ id: 'rose', color: '#704848' },
	{ id: 'light', color: '#f5f5f5' },
	{ id: 'softLight', color: '#a5a5a5' },
	{ id: 'warmGray', color: '#6b6560' },
];

export const DEFAULT_EPUB_READER_SETTINGS: EpubReaderSettings = {
	fontSize: 100,
	lineHeight: 1.6,
	textColor: 'auto',
	bgTheme: 'default',
	pageFlow: 'scrolled',
};

const TEXT_COLOR_MAP: Record<
	Exclude<EpubReaderTextColor, 'auto'>,
	string
> = Object.fromEntries(
	EPUB_TEXT_COLOR_OPTIONS.filter(
		(o): o is EpubTextColorOption & { color: string } =>
			o.id !== 'auto' && o.color != null,
	).map((o) => [o.id, o.color]),
) as Record<Exclude<EpubReaderTextColor, 'auto'>, string>;

export function resolveEpubTextColor(
	textColor: EpubReaderTextColor,
	appTheme: ThemeName,
): string {
	if (textColor === 'auto') {
		return appTheme === 'black' ? '#e8e8e8' : '#232323';
	}
	return TEXT_COLOR_MAP[textColor];
}

export function resolveEpubBgColor(
	bgTheme: EpubReaderBgTheme,
	_appTheme?: ThemeName,
): string {
	if (bgTheme === 'default') {
		return 'transparent';
	}
	const opt = EPUB_BG_THEME_OPTIONS.find((o) => o.id === bgTheme);
	return opt?.bgColor ?? 'transparent';
}

/** 阅读区实际背景色 */
export function resolveEpubReaderBackground(
	bgTheme: EpubReaderBgTheme,
	appTheme: ThemeName,
): string {
	return resolveEpubBgColor(bgTheme, appTheme);
}

/** EPUB 阅读页壳层/侧栏共用的表面背景 CSS 变量名 */
export const EPUB_READER_SURFACE_CSS_VAR = '--epub-reader-surface-bg';

/**
 * 页面壳、顶栏、侧栏与阅读区共用的表面背景。
 * default 跟随应用主题；其余与 iframe 内阅读背景一致。
 */
export function resolveEpubReaderSurfaceBackground(
	bgTheme: EpubReaderBgTheme,
): string {
	if (bgTheme === 'default') {
		return 'var(--theme-background)';
	}
	return resolveEpubBgColor(bgTheme);
}

/** 挂到阅读页壳层根节点，供子树 Tailwind 任意值引用 */
export function getEpubReaderSurfaceCssVars(
	bgTheme: EpubReaderBgTheme,
): Record<string, string> {
	return {
		[EPUB_READER_SURFACE_CSS_VAR]: resolveEpubReaderSurfaceBackground(bgTheme),
	};
}

/** 阅读页统一表面背景（需配合 getEpubReaderSurfaceCssVars） */
export const epubReaderSurfaceBgClass =
	'bg-[var(--epub-reader-surface-bg,var(--color-theme-background))]';

/** 略深于表面的 muted 层（替代 bg-theme/2） */
export const epubReaderSurfaceMutedClass =
	'bg-[color-mix(in_oklch,var(--epub-reader-surface-bg,var(--color-theme-background))_92%,var(--color-theme)_8%)]';

/** 列表选中态（替代 bg-theme/12） */
export const epubReaderSurfaceSelectedClass =
	'bg-[color-mix(in_oklch,var(--epub-reader-surface-bg,var(--color-theme-background))_88%,var(--color-theme)_12%)]';

/** 列表 hover（替代 hover:bg-theme/10） */
export const epubReaderSurfaceHoverClass =
	'hover:bg-[color-mix(in_oklch,var(--epub-reader-surface-bg,var(--color-theme-background))_90%,var(--color-theme)_10%)]';

/** 引用折叠渐变起点（替代 from-theme-background） */
export const epubReaderSurfaceFadeFromClass =
	'from-[var(--epub-reader-surface-bg,var(--color-theme-background))]';

/** 加载遮罩（替代 bg-theme-background/80） */
export const epubReaderSurfaceOverlayClass =
	'bg-[color-mix(in_oklch,var(--epub-reader-surface-bg,var(--color-theme-background))_80%,transparent)]';

/** @deprecated 请用 resolveEpubBgColor + inline style */
export function epubReaderHostBgClass(bgTheme: EpubReaderBgTheme): string {
	if (bgTheme === 'default') {
		return 'transparent';
	}
	return '';
}

export function loadEpubReaderSettings(): EpubReaderSettings {
	if (typeof window === 'undefined') return DEFAULT_EPUB_READER_SETTINGS;
	try {
		const raw = localStorage.getItem(EPUB_READER_SETTINGS_STORAGE_KEY);
		if (!raw) return DEFAULT_EPUB_READER_SETTINGS;
		const parsed = JSON.parse(raw) as Partial<EpubReaderSettings>;
		return {
			fontSize: clamp(parsed.fontSize ?? 100, 80, 160),
			lineHeight: clamp(parsed.lineHeight ?? 1.6, 1.2, 2.4),
			textColor: isTextColor(parsed.textColor)
				? parsed.textColor
				: DEFAULT_EPUB_READER_SETTINGS.textColor,
			bgTheme: migrateBgTheme(parsed.bgTheme),
			pageFlow: isPageFlow(parsed.pageFlow)
				? parsed.pageFlow
				: DEFAULT_EPUB_READER_SETTINGS.pageFlow,
		};
	} catch {
		return DEFAULT_EPUB_READER_SETTINGS;
	}
}

export function saveEpubReaderSettings(settings: EpubReaderSettings): void {
	try {
		localStorage.setItem(
			EPUB_READER_SETTINGS_STORAGE_KEY,
			JSON.stringify(settings),
		);
	} catch {
		// ignore
	}
}

/** 将字号、行距、文字颜色注入 epub.js rendition */
export function applyEpubReaderAppearance(
	rend: Rendition,
	settings: EpubReaderSettings,
	appTheme: ThemeName,
): void {
	const color = resolveEpubTextColor(settings.textColor, appTheme);
	const bgColor = resolveEpubReaderBackground(settings.bgTheme, appTheme);
	const lineHeight = String(settings.lineHeight);
	const fontSize = `${settings.fontSize}%`;
	const isDarkBg = settings.bgTheme === 'night' || appTheme === 'black';

	try {
		rend.themes.fontSize(fontSize);
	} catch {
		// 部分版本无 fontSize API 时仍依赖 CSS
	}

	rend.themes.default({
		html: {
			background: `${bgColor} !important`,
		},
		body: {
			color: `${color} !important`,
			background: `${bgColor} !important`,
			'line-height': `${lineHeight} !important`,
			'font-size': `${fontSize} !important`,
		},
		'p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, em, strong, i, b, a': {
			color: `${color} !important`,
			'line-height': `${lineHeight} !important`,
		},
		blockquote: {
			'line-height': `${lineHeight} !important`,
			'background-color': `${isDarkBg ? '#1e1e1e' : '#f5f5f5'} !important`,
			border: `1px solid ${isDarkBg ? '#333333' : '#e0e0e0'} !important`,
			'border-radius': `5px !important`,
		},
	});
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isTextColor(value: unknown): value is EpubReaderTextColor {
	return EPUB_TEXT_COLOR_OPTIONS.some((o) => o.id === value);
}

function migrateBgTheme(value: unknown): EpubReaderBgTheme {
	if (isBgTheme(value)) return value;
	return DEFAULT_EPUB_READER_SETTINGS.bgTheme;
}

function isBgTheme(value: unknown): value is EpubReaderBgTheme {
	return EPUB_BG_THEME_OPTIONS.some((o) => o.id === value);
}

function isPageFlow(value: unknown): value is EpubReaderPageFlow {
	return value === 'paginated' || value === 'scrolled';
}
