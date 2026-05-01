import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

export type Locale = 'zh-CN' | 'en-US';

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export const DICTS: Record<Locale, Record<string, string>> = {
	'zh-CN': zhCN,
	'en-US': enUS,
};

export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US'];
