import type { Locale } from '@/i18n';
import { getSitePageAbsoluteUrl } from '@/utils/public-doc-url';

/** 插件开发手册独立页路径（与路由表一致）。 */
export const PLUGIN_DEV_GUIDE_PATH = '/plugin-dev-guide';

/** 绝对地址；传入 `locale` 时追加 `?lang=`，便于新标签与主应用语言一致。 */
export function getPluginDevGuideAbsoluteUrl(locale?: Locale): string {
	return getSitePageAbsoluteUrl(PLUGIN_DEV_GUIDE_PATH, locale);
}
