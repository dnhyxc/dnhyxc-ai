import type { HostLocale } from './types';

/** registry 内嵌多语言文案（与 Host `locale` 对齐） */
export type PluginLocaleMap = Partial<Record<HostLocale, string>>;

/**
 * 从 registry 的 locale map（或旧版纯字符串）取当前语言文案。
 * 优先当前 locale → zh-CN → en-US → 空串。
 */
export function pickPluginLocaleText(
	value: PluginLocaleMap | string | undefined | null,
	locale: string,
): string {
	if (value == null) return '';
	if (typeof value === 'string') return value.trim();
	const cur = value[locale as HostLocale]?.trim();
	if (cur) return cur;
	return value['zh-CN']?.trim() || value['en-US']?.trim() || '';
}
