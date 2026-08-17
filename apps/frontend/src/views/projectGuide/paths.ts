import type { Locale } from '@/i18n';
import { getSitePageAbsoluteUrl } from '@/utils/public-doc-url';

/** 产品指南独立页路径（与路由表一致）。 */
export const PROJECT_GUIDE_PATH = '/project-guide';

/** 绝对地址；传入 `locale` 时追加 `?lang=`，并带上当前主题 `?theme=`（与分享页一致）。 */
export function getProjectGuideAbsoluteUrl(locale?: Locale): string {
	return getSitePageAbsoluteUrl(PROJECT_GUIDE_PATH, locale);
}
