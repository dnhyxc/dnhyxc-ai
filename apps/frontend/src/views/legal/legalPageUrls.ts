import type { Locale } from '@/i18n';
import { getSitePageAbsoluteUrl } from '@/utils/public-doc-url';

/** 主应用内法律页路径（与路由表一致，供关于窗口拼浏览器绝对 URL）。 */
export const LEGAL_PAGE_PATHS = {
	servicePolicy: '/service-policy',
	userAgreement: '/user-agreement',
} as const;

/** 当前站点下的法律页绝对地址；传入 `locale` 时追加 `?lang=`，与分享页通过 search 传参一致。 */
export function getLegalPageAbsoluteUrl(path: string, locale?: Locale): string {
	return getSitePageAbsoluteUrl(path, locale);
}
