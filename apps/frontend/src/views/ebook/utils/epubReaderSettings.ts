import type { Rendition } from 'epubjs';
import type { ThemeName } from '@/hooks';

export const EPUB_READER_SETTINGS_STORAGE_KEY = 'dnhyxc_epub_reader_settings';

export type EpubReaderTextColor = 'auto' | 'dark' | 'light' | 'sepia';

export type EpubReaderBgTheme =
	| 'default'
	| 'paper'
	| 'dark'
	| 'sepia'
	| 'green';

/** EPUB 阅读排版：分页（左右翻页）或连续滚动 */
export type EpubReaderPageFlow = 'paginated' | 'scrolled';

export type EpubReaderSettings = {
	fontSize: number;
	lineHeight: number;
	textColor: EpubReaderTextColor;
	bgTheme: EpubReaderBgTheme;
	pageFlow: EpubReaderPageFlow;
};

export const DEFAULT_EPUB_READER_SETTINGS: EpubReaderSettings = {
	fontSize: 100,
	lineHeight: 1.6,
	textColor: 'auto',
	bgTheme: 'default',
	pageFlow: 'paginated',
};

const TEXT_COLOR_MAP: Record<Exclude<EpubReaderTextColor, 'auto'>, string> = {
	dark: '#1e1e1e',
	light: '#fdfdfd',
	sepia: '#5b4636',
};

export function resolveEpubTextColor(
	textColor: EpubReaderTextColor,
	appTheme: ThemeName,
): string {
	if (textColor === 'auto') {
		return appTheme === 'black' ? '#fdfdfd' : '#1e1e1e';
	}
	return TEXT_COLOR_MAP[textColor];
}

export function epubReaderHostBgClass(bgTheme: EpubReaderBgTheme): string {
	switch (bgTheme) {
		case 'paper':
			return 'bg-[#fafafa]';
		case 'dark':
			return 'bg-[#1a1a1a]';
		case 'sepia':
			return 'bg-[#f4ecd8]';
		case 'green':
			return 'bg-[#dcefd5]';
		default:
			return 'bg-theme-background';
	}
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
			bgTheme: isBgTheme(parsed.bgTheme)
				? parsed.bgTheme
				: DEFAULT_EPUB_READER_SETTINGS.bgTheme,
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
	const lineHeight = String(settings.lineHeight);
	const fontSize = `${settings.fontSize}%`;

	try {
		rend.themes.fontSize(fontSize);
	} catch {
		// 部分版本无 fontSize API 时仍依赖 CSS
	}

	rend.themes.default({
		html: {
			background: 'transparent !important',
		},
		body: {
			color: `${color} !important`,
			background: 'transparent !important',
			'line-height': `${lineHeight} !important`,
			'font-size': `${fontSize} !important`,
		},
		'p, span, div, li, td, th, h1, h2, h3, h4, h5, h6, em, strong, i, b, a':
			// 'p, span, div, li, td, th, blockquote, h1, h2, h3, h4, h5, h6, em, strong, i, b, a':
			{
				color: `${color} !important`,
				'line-height': `${lineHeight} !important`,
			},
		blockquote: {
			'line-height': `${lineHeight} !important`,
			'background-color': `${appTheme === 'black' ? '#1e1e1e' : '#f5f5f5'} !important`,
			border: `1px solid ${appTheme === 'black' ? '#333333' : '#e0e0e0'} !important`,
			'border-radius': `5px !important`,
		},
	});
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function isTextColor(value: unknown): value is EpubReaderTextColor {
	return (
		value === 'auto' ||
		value === 'dark' ||
		value === 'light' ||
		value === 'sepia'
	);
}

function isBgTheme(value: unknown): value is EpubReaderBgTheme {
	return (
		value === 'default' ||
		value === 'paper' ||
		value === 'dark' ||
		value === 'sepia' ||
		value === 'green'
	);
}

function isPageFlow(value: unknown): value is EpubReaderPageFlow {
	return value === 'paginated' || value === 'scrolled';
}
