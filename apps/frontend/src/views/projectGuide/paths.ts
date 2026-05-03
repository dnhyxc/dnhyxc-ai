import type { Locale } from '@/i18n';
import { getSitePageAbsoluteUrl } from '@/utils/public-doc-url';

/** 产品指南独立页路径（与路由表一致）。 */
export const PROJECT_GUIDE_PATH = '/project-guide';

/** 绝对地址；传入 `locale` 时追加 `?lang=`，便于新标签与主应用语言一致。 */
export function getProjectGuideAbsoluteUrl(locale?: Locale): string {
	return getSitePageAbsoluteUrl(PROJECT_GUIDE_PATH, locale);
}
