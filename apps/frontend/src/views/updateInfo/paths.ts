import type { Locale } from '@/i18n';
import { getSitePageAbsoluteUrl } from '@/utils/public-doc-url';

/** 更新信息独立页路径（与路由表一致）。 */
export const UPDATE_INFO_PATH = '/update-info';

/** 绝对地址；传入 `locale` 时追加 `?lang=`，与分享页通过 search 传参一致。 */
export function getUpdateInfoAbsoluteUrl(locale?: Locale): string {
	return getSitePageAbsoluteUrl(UPDATE_INFO_PATH, locale);
}
