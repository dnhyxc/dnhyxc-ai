import { isTauriRuntime } from './runtime';

/** 浏览器回退：与 plugin-store 行为对齐的内存缓存 + localStorage 持久化 */
const BROWSER_STORE_KEY = 'dnhyxc_settings_json';

let browserCache: Record<string, unknown> | null = null;

let tauriStorePromise: Promise<
	import('@tauri-apps/plugin-store').Store
> | null = null;

async function getTauriStore() {
	if (!isTauriRuntime()) {
		return null;
	}
	if (!tauriStorePromise) {
		tauriStorePromise = (async () => {
			const { appDataDir, join } = await import('@tauri-apps/api/path');
			const { Store } = await import('@tauri-apps/plugin-store');
			const dataDir = await appDataDir();
			const settingsPath = await join(dataDir, 'settings.json');
			return Store.load(settingsPath);
		})();
	}
	return tauriStorePromise;
}

async function ensureBrowserCache(): Promise<Record<string, unknown>> {
	if (browserCache !== null) {
		return browserCache;
	}
	try {
		browserCache = JSON.parse(
			localStorage.getItem(BROWSER_STORE_KEY) || '{}',
		) as Record<string, unknown>;
	} catch {
		browserCache = {};
	}
	return browserCache;
}

async function persistBrowserStore(): Promise<void> {
	const cache = await ensureBrowserCache();
	localStorage.setItem(BROWSER_STORE_KEY, JSON.stringify(cache));
}

export const setValue = async <T = any>(
	key: string,
	value: T,
	saveNow = true,
) => {
	const store = await getTauriStore();
	if (store) {
		await store.set(key, value);
		if (saveNow) {
			await store.save();
		}
		return;
	}
	const cache = await ensureBrowserCache();
	cache[key] = value as unknown;
	if (saveNow) {
		await persistBrowserStore();
	}
};

export const getValue = async <T = any>(
	key: string,
): Promise<T | undefined> => {
	const store = await getTauriStore();
	if (store) {
		return store.get<T>(key);
	}
	const cache = await ensureBrowserCache();
	return cache[key] as T | undefined;
};

export const save = async () => {
	const store = await getTauriStore();
	if (store) {
		return store.save();
	}
	await persistBrowserStore();
};

export const deleteValue = async (key: string) => {
	const store = await getTauriStore();
	if (store) {
		await store.delete(key);
		return;
	}
	const cache = await ensureBrowserCache();
	delete cache[key];
	await persistBrowserStore();
};
