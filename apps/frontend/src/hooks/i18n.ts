import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_LOCALE, DICTS, type Locale, SUPPORTED_LOCALES } from '@/i18n';
import { getValue, onEmit, setValue } from '@/utils';

/** 供首屏同步读取，降低刷新时语言晚于首帧 */
export const LOCALE_BOOTSTRAP_STORAGE_KEY = 'dnhyxc_locale_bootstrap';

function persistLocaleBootstrap(locale: Locale) {
	try {
		localStorage.setItem(LOCALE_BOOTSTRAP_STORAGE_KEY, locale);
	} catch {
		// 私密模式等场景忽略
	}
}

function parseLocaleFromSearch(search: string): Locale | null {
	try {
		const params = new URLSearchParams(
			search.startsWith('?') ? search : `?${search}`,
		);
		const raw = params.get('lang') || params.get('locale');
		if (!raw) return null;
		return SUPPORTED_LOCALES.includes(raw as Locale) ? (raw as Locale) : null;
	} catch {
		return null;
	}
}

function readLocaleBootstrapSync(): Locale | null {
	if (typeof window === 'undefined') return null;
	try {
		const fromUrl = parseLocaleFromSearch(window.location.search);
		if (fromUrl) return fromUrl;
		const b = localStorage.getItem(LOCALE_BOOTSTRAP_STORAGE_KEY) as Locale;
		return SUPPORTED_LOCALES.includes(b) ? b : null;
	} catch {
		return null;
	}
}

function applyLangToDocument(locale: Locale) {
	try {
		document.documentElement.lang = locale;
	} catch {
		// ignore
	}
}

function interpolate(
	template: string,
	params?: Record<string, unknown>,
): string {
	if (!params) return template;
	return template.replace(/\{(\w+)\}/g, (full, k) => {
		const v = params[k];
		return v == null ? full : String(v);
	});
}

// ---- 全局 i18n 状态（保证任意组件切换语言都会更新） ----
let currentLocale: Locale = readLocaleBootstrapSync() ?? DEFAULT_LOCALE;
const localeListeners = new Set<() => void>();

function emitLocaleChanged() {
	for (const l of localeListeners) l();
}

function subscribeLocale(listener: () => void) {
	localeListeners.add(listener);
	return () => localeListeners.delete(listener);
}

function getLocaleSnapshot(): Locale {
	return currentLocale;
}

async function setLocaleGlobal(
	next: Locale,
	opts?: { syncUrl?: boolean; emitEvent?: boolean },
) {
	if (!SUPPORTED_LOCALES.includes(next)) return;
	if (next === currentLocale) return;
	currentLocale = next;
	applyLangToDocument(next);
	persistLocaleBootstrap(next);
	emitLocaleChanged();
	await setValue('locale', next);
	if (opts?.emitEvent !== false) {
		// 跨窗口同步：主窗口切换语言后，子窗口自动跟随
		await onEmit('locale', next);
	}

	// 推荐：同步覆盖 URL lang，保证复制/刷新一致
	if (opts?.syncUrl !== false && typeof window !== 'undefined') {
		try {
			const u = new URL(window.location.href);
			u.searchParams.set('lang', next);
			window.history.replaceState(null, '', u.toString());
		} catch {
			// ignore
		}
	}
}

export function useI18n() {
	const locale = useSyncExternalStore(
		subscribeLocale,
		getLocaleSnapshot,
		() => DEFAULT_LOCALE,
	);

	useEffect(() => {
		// 启动时先应用一次，避免“默认语言选中但未生效”
		applyLangToDocument(locale);
		persistLocaleBootstrap(locale);

		const init = async () => {
			if (typeof window !== 'undefined') {
				const fromUrl = parseLocaleFromSearch(window.location.search);
				if (fromUrl) {
					await setLocaleGlobal(fromUrl, { syncUrl: false });
					// 仅写 bootstrap，不强制覆盖用户持久化设置
					return;
				}
			}

			const stored = (await getValue('locale')) as Locale | undefined;
			if (stored && SUPPORTED_LOCALES.includes(stored)) {
				await setLocaleGlobal(stored, { syncUrl: false });
			}
		};
		void init();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const dict = useMemo(() => DICTS[locale] ?? DICTS[DEFAULT_LOCALE], [locale]);
	const fallbackDict = DICTS[DEFAULT_LOCALE];

	const t = useMemo(() => {
		return (key: string, params?: Record<string, unknown>) => {
			const raw = dict[key] ?? fallbackDict[key];
			if (!raw) return key;
			return interpolate(raw, params);
		};
	}, [dict, fallbackDict]);

	const setLocale = async (
		next: Locale,
		opts?: { syncUrl?: boolean; emitEvent?: boolean },
	) => {
		await setLocaleGlobal(next, opts);
	};

	const toggleLocale = async () => {
		await setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN');
	};

	return {
		locale,
		setLocale,
		toggleLocale,
		t,
		supportedLocales: SUPPORTED_LOCALES,
	};
}
