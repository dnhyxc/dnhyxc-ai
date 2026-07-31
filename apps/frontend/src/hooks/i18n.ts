import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { DEFAULT_LOCALE, DICTS, type Locale, SUPPORTED_LOCALES } from '@/i18n';
import { onEmit } from '@/utils/event';
import { getValue, setValue } from '@/utils/store';

/** 供首屏同步读取，降低刷新时语言晚于首帧 */
export const LOCALE_BOOTSTRAP_STORAGE_KEY = 'dnhyxc_locale_bootstrap';

/** MF / HMR 可能复制本模块；locale 与订阅者必须挂在 globalThis 上才能跨副本同步 */
const LOCALE_RUNTIME_KEY = '__dnhyxc_locale_runtime__';
const LOCALE_INIT_KEY = '__dnhyxc_locale_init_done__';

type LocaleRuntime = {
	locale: Locale;
	listeners: Set<() => void>;
};

function getLocaleRuntime(): LocaleRuntime {
	const g = globalThis as typeof globalThis & {
		[LOCALE_RUNTIME_KEY]?: LocaleRuntime;
	};
	if (!g[LOCALE_RUNTIME_KEY]) {
		g[LOCALE_RUNTIME_KEY] = {
			locale: readLocaleBootstrapSync() ?? DEFAULT_LOCALE,
			listeners: new Set(),
		};
	}
	return g[LOCALE_RUNTIME_KEY];
}

function persistLocaleBootstrap(locale: Locale) {
	try {
		localStorage.setItem(LOCALE_BOOTSTRAP_STORAGE_KEY, locale);
	} catch {
		// 私密模式等场景忽略
	}
}

/** 从 URL 查询串解析语言（支持 `lang` 或 `locale`，与分享页等通过 search 传参一致）。 */
export function parseLocaleFromSearch(search: string): Locale | null {
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

function emitLocaleChanged() {
	for (const l of getLocaleRuntime().listeners) l();
}

function subscribeLocale(listener: () => void) {
	const { listeners } = getLocaleRuntime();
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function getLocaleSnapshot(): Locale {
	return getLocaleRuntime().locale;
}

async function setLocaleGlobal(
	next: Locale,
	opts?: { syncUrl?: boolean; emitEvent?: boolean },
) {
	if (!SUPPORTED_LOCALES.includes(next)) return;
	const runtime = getLocaleRuntime();
	if (next === runtime.locale) return;
	runtime.locale = next;
	applyLangToDocument(next);
	persistLocaleBootstrap(next);

	// 先写 URL，再通知订阅者：避免重挂组件的 init 读到旧 lang 又切回去
	if (opts?.syncUrl !== false && typeof window !== 'undefined') {
		try {
			const u = new URL(window.location.href);
			u.searchParams.set('lang', next);
			window.history.replaceState(null, '', u.toString());
		} catch {
			// ignore
		}
	}

	emitLocaleChanged();
	await setValue('locale', next);
	if (opts?.emitEvent !== false) {
		// 跨窗口同步：主窗口切换语言后，子窗口自动跟随
		await onEmit('locale', next);
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

		const g = globalThis as typeof globalThis & {
			[LOCALE_INIT_KEY]?: boolean;
		};
		// 全应用只 hydrate 一次，避免路由/key 重挂时用旧 URL/store 覆盖刚切好的语言
		if (g[LOCALE_INIT_KEY]) return;
		g[LOCALE_INIT_KEY] = true;

		const init = async () => {
			if (typeof window !== 'undefined') {
				const fromUrl = parseLocaleFromSearch(window.location.search);
				if (fromUrl) {
					await setLocaleGlobal(fromUrl, { syncUrl: false });
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
