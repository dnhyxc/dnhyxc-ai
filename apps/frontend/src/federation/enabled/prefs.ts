import { notifyPluginEnabled } from '@dnhyxc-ai/federation-kit';
import { getPluginEnabledPrefs, updatePluginEnabledPrefs } from '@/service';
import { getLoggedInUserId } from '@/store/loggedInUserId';

let cachedUserId = 0;
let cachedIds = new Set<string>();
let loadPromise: Promise<void> | null = null;
/** 未拉取完成前 get 为 false，勿当成「已下架」 */
let prefsReady = false;

export function arePluginEnabledPrefsReady(): boolean {
	return prefsReady;
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

export function clearPluginEnabledPrefsCache(): void {
	cachedUserId = 0;
	cachedIds = new Set();
	loadPromise = null;
	prefsReady = false;
	notifyPluginEnabled();
}

/** 同步读内存缓存；未加载则视为全关 */
export function getPluginEnabledPref(id: string): boolean {
	return cachedIds.has(id);
}

/** 从服务端拉取并写入内存 */
export async function ensurePluginEnabledPrefsLoaded(
	userId?: number,
): Promise<void> {
	const id = userId ?? getLoggedInUserId();
	if (id <= 0) {
		cachedUserId = 0;
		cachedIds = new Set();
		loadPromise = null;
		prefsReady = true;
		notifyPluginEnabled();
		return;
	}
	if (cachedUserId === id && prefsReady && !loadPromise) return;
	if (loadPromise) {
		await loadPromise;
		return;
	}

	loadPromise = (async () => {
		try {
			const res = await getPluginEnabledPrefs({ silent: true });
			setCache(id, idsFromResponse(res.data));
		} catch {
			setCache(id, []);
		} finally {
			prefsReady = true;
			loadPromise = null;
			notifyPluginEnabled();
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
	const saved = idsFromResponse(res.data);
	// 响应异常时保留乐观缓存，避免把已开启项冲成全关
	setCache(userId, saved.length > 0 || !enabled ? saved : enabledIds);
}
