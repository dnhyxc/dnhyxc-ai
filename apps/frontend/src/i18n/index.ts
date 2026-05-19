import { enUS } from './locales/en-US';
import { zhCN } from './locales/zh-CN';

export type Locale = 'zh-CN' | 'en-US';

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export const DICTS: Record<Locale, Record<string, string>> = {
	'zh-CN': zhCN,
	'en-US': enUS,
};

export const SUPPORTED_LOCALES: Locale[] = ['zh-CN', 'en-US'];

const LOCALE_BOOTSTRAP_STORAGE_KEY = 'dnhyxc_locale_bootstrap';

/** 供非 React 模块（如 HttpClient Toast）读取当前语言 */
export function getActiveLocale(): Locale {
	if (typeof window === 'undefined') {
		return DEFAULT_LOCALE;
	}
	try {
		const params = new URLSearchParams(window.location.search);
		const fromUrl = params.get('lang') || params.get('locale');
		if (fromUrl === 'zh-CN' || fromUrl === 'en-US') {
			return fromUrl;
		}
		const stored = localStorage.getItem(LOCALE_BOOTSTRAP_STORAGE_KEY) as Locale;
		if (SUPPORTED_LOCALES.includes(stored)) {
			return stored;
		}
	} catch {
		// ignore
	}
	return DEFAULT_LOCALE;
}

/** 同步翻译（无 React 上下文） */
export function translateSync(key: string): string {
	const locale = getActiveLocale();
	const dict = DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
	const fallback = DICTS[DEFAULT_LOCALE];
	return dict[key] ?? fallback[key] ?? key;
}
