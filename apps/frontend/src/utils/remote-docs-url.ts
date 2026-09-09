import {
	type AccentId,
	appendShareAccentQuery,
	appendShareThemeQuery,
	readAccentBootstrapSync,
	readThemeBootstrapSync,
	type ThemeName,
} from '@/hooks/theme';
import type { Locale } from '@/i18n';
import { withAppLangInSearch } from '@/utils/public-doc-url';

/** 与 remote-docs / registry routePath 一致 */
export const UPDATE_INFO_PATH = '/update-info';
export const PROJECT_GUIDE_PATH = '/project-guide';
export const PLUGIN_DEV_GUIDE_PATH = '/plugin-dev-guide';

/**
 * remote-docs 独立站 origin。
 * - 可用 `VITE_REMOTE_DOCS_ORIGIN` 覆盖
 * - DEV 缺省：http://127.0.0.1:9013
 * - PROD 缺省：https://dnhyxc.cn:9017
 */
export function getRemoteDocsOrigin(): string {
	const fromEnv = String(import.meta.env.VITE_REMOTE_DOCS_ORIGIN ?? '')
		.trim()
		.replace(/\/$/, '');
	if (fromEnv) return fromEnv;
	if (import.meta.env.DEV) return 'http://127.0.0.1:9013';
	return 'https://dnhyxc.cn:9017';
}

/** 拼 remote-docs 绝对 URL（lang / theme / accent） */
export function getRemoteDocsAbsoluteUrl(
	path: string,
	locale?: Locale,
	themeName?: ThemeName | null,
	accentId?: AccentId | null,
): string {
	const origin = getRemoteDocsOrigin();
	const normalized = path.startsWith('/') ? path : `/${path}`;
	let url = origin ? `${origin}${normalized}` : normalized;
	if (locale) url = withAppLangInSearch(url, locale);
	const theme = themeName === undefined ? readThemeBootstrapSync() : themeName;
	if (theme) url = appendShareThemeQuery(url, theme);
	const accent = accentId === undefined ? readAccentBootstrapSync() : accentId;
	if (accent) url = appendShareAccentQuery(url, accent);
	return url;
}

export function getUpdateInfoAbsoluteUrl(locale?: Locale): string {
	return getRemoteDocsAbsoluteUrl(UPDATE_INFO_PATH, locale);
}

export function getProjectGuideAbsoluteUrl(locale?: Locale): string {
	return getRemoteDocsAbsoluteUrl(PROJECT_GUIDE_PATH, locale);
}

export function getPluginDevGuideAbsoluteUrl(locale?: Locale): string {
	return getRemoteDocsAbsoluteUrl(PLUGIN_DEV_GUIDE_PATH, locale);
}
