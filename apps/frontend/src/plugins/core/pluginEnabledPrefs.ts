import {
	getPluginEnabledPrefs,
	updatePluginEnabledPrefs,
} from '@/service/pluginEnabledPrefs';
import {
	getLoggedInUserId,
	userScopedStorageKey,
} from '@/store/loggedInUserId';

/** 旧版 localStorage（一次性迁移到服务端后删除） */
const LEGACY_BASE_KEY = `dnhyxc.plugin.enabled.${import.meta.env.PROD ? 'prod' : 'dev'}.v1`;

type Prefs = Record<string, boolean>;

let cachedUserId = 0;
let cachedIds = new Set<string>();
let loadPromise: Promise<void> | null = null;

function legacyKey(userId: number): string {
	return userScopedStorageKey(LEGACY_BASE_KEY, userId);
}

function readLegacyLocal(userId: number): Prefs {
	if (typeof window === 'undefined' || userId <= 0) return {};
	try {
		const raw =
			localStorage.getItem(legacyKey(userId)) ??
			localStorage.getItem(LEGACY_BASE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return {};
		}
		return parsed as Prefs;
	} catch {
		return {};
	}
}

function removeLegacyLocal(userId: number): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem(legacyKey(userId));
	localStorage.removeItem(LEGACY_BASE_KEY);
}

function normalizeIds(raw: unknown): string[] {
	if (typeof raw === 'string') {
		try {
			return normalizeIds(JSON.parse(raw));
		} catch {
			return [];
		}
	}
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: string[] = [];
	for (const item of raw) {
		if (typeof item !== 'string') continue;
		const id = item.trim().slice(0, 64);
		if (!id || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
}

function setCache(userId: number, ids: string[]): void {
	cachedUserId = userId;
	cachedIds = new Set(normalizeIds(ids));
}

/** 兼容 res.data.enabledIds / 偶发整包 / JSON 字符串 */
function idsFromResponse(data: unknown): string[] {
	if (!data || typeof data !== 'object') return [];
	const obj = data as Record<string, unknown>;
	if ('enabledIds' in obj) return normalizeIds(obj.enabledIds);
	if (Array.isArray(data)) return normalizeIds(data);
	return [];
}

function idsFromPrefs(prefs: Prefs): string[] {
	return Object.keys(prefs).filter((id) => prefs[id] === true);
}

export function clearPluginEnabledPrefsCache(): void {
	cachedUserId = 0;
	cachedIds = new Set();
	loadPromise = null;
}

/** 同步读内存缓存；未加载则视为全关 */
export function getPluginEnabledPref(id: string): boolean {
	return cachedIds.has(id);
}

/** 从服务端拉取并写入内存（含旧 localStorage 一次性迁移） */
export async function ensurePluginEnabledPrefsLoaded(
	userId?: number,
): Promise<void> {
	const id = userId ?? getLoggedInUserId();
	if (id <= 0) {
		clearPluginEnabledPrefsCache();
		return;
	}
	if (cachedUserId === id && !loadPromise) return;
	if (loadPromise) {
		await loadPromise;
		return;
	}

	loadPromise = (async () => {
		try {
			const legacy = readLegacyLocal(id);
			const legacyIds = idsFromPrefs(legacy);
			const res = await getPluginEnabledPrefs({ silent: true });
			const serverIds = idsFromResponse(res.data);
			// 服务端为空且本地有旧偏好时，一次性迁到服务端
			if (serverIds.length === 0 && legacyIds.length > 0) {
				const migrated = await updatePluginEnabledPrefs(
					{ enabledIds: legacyIds },
					{ silent: true },
				);
				removeLegacyLocal(id);
				setCache(id, idsFromResponse(migrated.data));
				return;
			}
			if (legacyIds.length > 0) removeLegacyLocal(id);
			setCache(id, serverIds);
		} catch {
			const legacy = readLegacyLocal(id);
			setCache(id, idsFromPrefs(legacy));
		} finally {
			loadPromise = null;
		}
	})();

	await loadPromise;
}

/** 登录后预拉取 */
export function prefetchPluginEnabledPrefs(userId?: number): void {
	void ensurePluginEnabledPrefsLoaded(userId);
}

/**
 * 更新单个插件上架状态并写回服务端。
 * 未登录时仅改内存（默认关，切号即丢）。
 */
export async function setPluginEnabledPref(
	id: string,
	enabled: boolean,
): Promise<void> {
	const userId = getLoggedInUserId();
	const next = new Set(cachedIds);
	if (enabled) next.add(id);
	else next.delete(id);
	const enabledIds = [...next];

	if (userId <= 0) {
		setCache(0, enabledIds);
		return;
	}

	setCache(userId, enabledIds);
	const res = await updatePluginEnabledPrefs({ enabledIds });
	removeLegacyLocal(userId);
	const saved = idsFromResponse(res.data);
	// 响应异常时保留乐观缓存，避免把已开启项冲成全关
	setCache(userId, saved.length > 0 || !enabled ? saved : enabledIds);
}
