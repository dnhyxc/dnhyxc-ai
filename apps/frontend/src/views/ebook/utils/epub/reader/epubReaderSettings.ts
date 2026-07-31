/**
 * 本文件实现了 EPUB 阅读器的设置管理与主题样式方案，核心包含：
 *
 * 1. 设置项类型定义
 *    - 包括阅读背景（EpubReaderBgTheme）、文字颜色（EpubReaderTextColor）、分页方式（EpubReaderPageFlow）等多种类型及对应选项集合。
 *    - 用 TypeScript 类型明确限制各设置项的合法取值，防止异常输入。
 *
 * 2. 主题方案枚举与属性
 *    - 提供多款主流阅读背景主题（如纸张、夜间、护眼绿等），对齐 Kindle、iBooks、微信读书体验。
 *    - 对每种主题配置具体的背景色（bgColor），支持 default 跟随应用主题自动切换，其余颜色写死保证一致表现。
 *
 * 3. 设置读取与存储
 *    - 通过 localStorage 长久保存用户自定义的阅读设置，首次或失效时自动回退默认设置，保证兼容全量老数据。
 *    - 对字体大小、行距等数值项做 clamp 限定，防止极端值带来的渲染异常。
 *
 * 4. CSS 变量与样式方案
 *    - 提供阅读页主背景（surface）相关的 CSS 变量、Tailwind 类名及渐变处理，便于整站各层（页壳/侧栏/正文区）复用统一风格。
 *    - 强调 default 主题模式严格跟随全局应用 theme，其余 theme 直接映射到固定颜色，兼容单独调亮/护眼等需求。
 *
 * 5. 兼容性/历史兼容
 *    - 内建 bgTheme 迁移与取值容错，保障版本升级或字段变更时数据不丢失、体验不中断。
 *
 * 主要出口：
 *   - 类型定义：EpubReaderSettings、EpubReaderBgTheme、EpubReaderTextColor、EpubReaderPageFlow 等
 *   - 设置读取/落盘方法：loadEpubReaderSettings
 *   - 主题色解析函数：resolveEpubBgColor、resolveEpubReaderSurfaceBackground
 *   - CSS 变量与 Tailwind 类名常量：getEpubReaderSurfaceCssVars、epubReaderSurfaceBgClass 等
 */
import type { Rendition } from 'epubjs';
import type { ThemeName } from '@/hooks';
import { cn } from '@/lib/utils';

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

/** 阅读页 chrome（顶栏/设置/播放条等）正文字色 CSS 变量名 */
export const EPUB_READER_TEXT_CSS_VAR = '--epub-reader-text-color';

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

/** 阅读页 chrome：表面背景 + 正文字色（覆盖 --color-textcolor 供 text-textcolor/* 继承） */
export function getEpubReaderChromeCssVars(
	bgTheme: EpubReaderBgTheme,
	textColor: EpubReaderTextColor,
	appTheme: ThemeName,
): Record<string, string> {
	const resolvedText = resolveEpubTextColor(textColor, appTheme);
	return {
		...getEpubReaderSurfaceCssVars(bgTheme),
		[EPUB_READER_TEXT_CSS_VAR]: resolvedText,
		'--color-textcolor': resolvedText,
		'--theme-textcolor': resolvedText,
		// body 的 text-textcolor 在子树内继承的是 body 处算出的色值；根节点显式设 color 才能让 textarea 等未挂 utility 的节点跟随阅读字色
		color: resolvedText,
		// Portal 下拉/抽屉不在阅读壳子 DOM 内，须 inline 背景避免仍用 bg-theme-background（应用主题）
		backgroundColor: resolveEpubReaderSurfaceBackground(bgTheme),
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

/** 阅读页 chrome 分隔线色（基于正文字色，避免 border-theme 在自定义阅读背景上不可见） */
export const epubReaderChromeBorderColorClass = 'border-theme/10';

/** 阅读页 chrome 次要按钮（取消、删除等） */
export const epubReaderChromeOutlineButtonClass =
	'border-textcolor/28 text-textcolor bg-transparent shadow-none hover:bg-textcolor/10';

/** 阅读页 chrome 主按钮（保存、编辑等；字/底反转保证与表面背景对比） */
export const epubReaderChromePrimaryButtonClass =
	'bg-textcolor text-[var(--epub-reader-surface-bg,var(--color-theme-background))] hover:bg-textcolor/90 border-transparent';

/** 阅读页 chrome 内 textarea：覆盖 ui/Textarea 默认 placeholder/caret */
export const epubReaderChromeTextareaClass =
	'text-textcolor placeholder:text-textcolor/40 caret-textcolor';

/** Portal 下拉菜单容器（分句/倍速等；覆盖 DropdownMenuContent 默认 bg-theme-background） */
export const epubReaderChromeMenuContentClass = cn(
	epubReaderSurfaceBgClass,
	epubReaderChromeBorderColorClass,
	'border text-textcolor',
);

/** 阅读 chrome 列表项：默认 / 选中（与 EbookTocDrawer 目录项一致；跟阅读字色，勿用 text-theme） */
export const epubReaderChromeListItemIdleClass =
	'text-textcolor transition-colors hover:bg-textcolor/8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-textcolor/30';

export const epubReaderChromeListItemActiveClass =
	'bg-textcolor/12 text-textcolor font-medium hover:bg-textcolor/12 focus-visible:outline-none focus-visible:bg-textcolor/12 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-textcolor/30';

/** 选区 PopBar 毛玻璃面板（基于阅读 surface，Portal 内需配合 getEpubReaderChromeCssVars） */
export const epubReaderPopBarSurfaceClass =
	'rounded-md bg-[color-mix(in_oklch,var(--epub-reader-surface-bg,var(--color-theme-card))_92%,transparent)] backdrop-blur-md backdrop-saturate-150 text-textcolor';

/** PopBar 箭头 fill，与面板 surface 同色 */
export const EPUB_READER_POPBAR_CARET_FILL =
	'color-mix(in oklch, var(--epub-reader-surface-bg, var(--color-theme-card)) 92%, transparent)';

/** 跟随应用 / 夜间用主题 shadow-6；其余阅读背景用固定 rgba 投影 */
export function epubReaderPopBarShadowClass(
	bgTheme: EpubReaderBgTheme,
): string {
	if (bgTheme === 'default' || bgTheme === 'night') {
		return 'drop-shadow-(--shadow-6)';
	}
	return 'drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]';
}

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
			padding: `2px 6px !important`,
		},
		'.kindle-cn-frame-zhishidian': {
			'background-color': `${isDarkBg ? '#1e1e1e' : '#f5f5f5'} !important`,
			'border-radius': '5px !important',
		},
		'.kindle-cn-frame-zsdtext': {
			'background-color': `${isDarkBg ? '#1e1e1e' : '#f5f5f5'} !important`,
			'border-top-left-radius': '5px !important',
			'border-top-right-radius': '5px !important',
		},
		'.kindle-cn-frame-yuanjiao': {
			'border-color': '#666 !important',
		},
		'.kindle-cn-frame-zhijiao': {
			'border-color': '#666 !important',
			'border-radius': '5px !important',
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
