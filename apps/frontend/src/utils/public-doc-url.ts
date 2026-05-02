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
 * 当前站点下的页面绝对 URL：有 `window` 时拼 `origin + path`，否则仅返回 `path`（SSR）。
 * 传入 `locale` 时经 `withAppLangInSearch` 追加 `?lang=`，与分享页 search 传参一致。
 */
export function getSitePageAbsoluteUrl(path: string, locale?: Locale): string {
	const base =
		typeof window === 'undefined'
			? path
			: `${
					import.meta.env.DEV
						? import.meta.env.VITE_DEV_WEB_DOMAIN
						: import.meta.env.VITE_PROD_WEB_DOMAIN
				}${path}`;
	return locale ? withAppLangInSearch(base, locale) : base;
}
