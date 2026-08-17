import {
	appendShareThemeQuery,
	readThemeBootstrapSync,
	type ThemeName,
} from '@/hooks/theme';
import type { Locale } from '@/i18n';
import { SUPPORTED_LOCALES } from '@/i18n';

/**
 * 为绝对 URL 追加 `lang` 查询参数，便于独立窗口/新标签与主应用语言一致（与 share 使用 `type` 等同为 search 传参）。
 */
export function withAppLangInSearch(
	absoluteUrl: string,
	locale: Locale,
): string {
	if (!absoluteUrl || !SUPPORTED_LOCALES.includes(locale)) {
		return absoluteUrl;
	}
	try {
		const u = new URL(absoluteUrl);
		u.searchParams.set('lang', locale);
		return u.toString();
	} catch {
		return absoluteUrl;
	}
}

/**
 * 独立页切换语言：只改 `lang`，保留 `theme` 等现有 search。
 */
export function withStandaloneLangSearch(nextLocale: Locale): string {
	const p = new URLSearchParams(
		typeof window !== 'undefined' ? window.location.search : '',
	);
	p.set('lang', nextLocale);
	return p.toString();
}

/**
 * 当前站点下的页面绝对 URL：有 `window` 时拼 `origin + path`，否则仅返回 `path`（SSR）。
 * 传入 `locale` 时追加 `?lang=`；主题默认取本地 bootstrap（与壳内一致），也可显式传入。
 * 外链打开的独立页（产品指南 / 插件开发手册等）靠 `?theme=` 对齐桌面端主题。
 */
export function getSitePageAbsoluteUrl(
	path: string,
	locale?: Locale,
	themeName?: ThemeName | null,
): string {
	const base =
		typeof window === 'undefined'
			? path
			: `${
					import.meta.env.DEV
						? import.meta.env.VITE_DEV_WEB_DOMAIN
						: import.meta.env.VITE_PROD_WEB_DOMAIN
				}${path}`;
	const url = locale ? withAppLangInSearch(base, locale) : base;
	const theme = themeName === undefined ? readThemeBootstrapSync() : themeName;
	return theme ? appendShareThemeQuery(url, theme) : url;
}
