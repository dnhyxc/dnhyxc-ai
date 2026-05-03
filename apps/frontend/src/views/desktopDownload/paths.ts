import type { Locale } from '@/i18n';
import { getSitePageAbsoluteUrl } from '@/utils/public-doc-url';

/** 桌面端下载页路径（与路由表一致）。 */
export const DOWNLOAD_DESKTOP_PATH = '/download-desktop';

/** 绝对地址；传入 `locale` 时追加 `?lang=`。 */
export function getDesktopDownloadAbsoluteUrl(locale?: Locale): string {
	return getSitePageAbsoluteUrl(DOWNLOAD_DESKTOP_PATH, locale);
}
