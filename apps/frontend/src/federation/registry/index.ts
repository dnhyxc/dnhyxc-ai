import {
	isPluginEnabled,
	notifyPluginEnabled,
	type PluginRegistry,
	satisfiesRange,
} from '@dnhyxc-ai/federation-kit';
import { translateSync } from '@/i18n';
import { putUploadRemoteJson } from '@/service';
import { getPlatformFetch } from '@/utils/fetch';
import { resolveUploadedFileUrl } from '@/utils/upload-file-url';
import { setPluginEnabledPref } from '../enabled/prefs';

const HOST_API_VERSION =
	import.meta.env.VITE_HOST_API_VERSION?.trim() || '1.0.0';

const CACHE_KEY = `dnhyxc.plugin.registry.${import.meta.env.PROD ? 'prod' : 'dev'}.v1`;
export const PLUGIN_REGISTRY_CACHE_KEY = CACHE_KEY;
export const PLUGIN_REGISTRY_FILENAME = 'plugins-registry.json';
/** 落盘相对路径；展示/拉取用 resolveUploadedFileUrl（与图片一致） */
export const PLUGIN_REGISTRY_STATIC_PATH = `/remotes/${PLUGIN_REGISTRY_FILENAME}`;

/**
 * 对齐 `resolveUploadedFileUrl`：
 * - Web DEV：同源 `/remotes/...`（Vite 代理）
 * - Web PROD：同源 `/api/upload/serve?path=...`
 * - Tauri DEV：静态源站 `/remotes/...`
 * - Tauri PROD：`/api/upload/serve?path=...`
 */
function registryUrl(): string {
	const override = (
		import.meta.env.PROD
			? import.meta.env.VITE_PROD_PLUGIN_REGISTRY_URL
			: import.meta.env.VITE_DEV_PLUGIN_REGISTRY_URL
	)?.trim();
	if (override) return override;
	return resolveUploadedFileUrl(PLUGIN_REGISTRY_STATIC_PATH);
}

export function formatRegistryUpdatedAt(d = new Date()): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function readCache(): PluginRegistry | null {
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		if (!cached) return null;
		const data = JSON.parse(cached) as PluginRegistry;
		if (!Array.isArray(data.plugins) || data.plugins.length === 0) return null;
		return data;
	} catch {
		return null;
	}
}

function writeCache(data: PluginRegistry) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(data));
	} catch {
		/* ignore */
	}
	notifyPluginEnabled();
}

function withCacheBust(url: string): string {
	const sep = url.includes('?') ? '&' : '?';
	return `${url}${sep}t=${Date.now()}`;
}

async function fetchRegistryText(
	url: string,
	force?: boolean,
): Promise<string> {
	const doFetch = /^https?:\/\//i.test(url)
		? await getPlatformFetch()
		: globalThis.fetch.bind(globalThis);
	const fetchUrl = force ? withCacheBust(url) : url;
	const res = await doFetch(fetchUrl, {
		cache: 'no-store',
		...(force ? { headers: { 'Cache-Control': 'no-cache' } } : {}),
	});
	if (!res.ok) throw new Error(`registry ${res.status}`);
	return res.text();
}

function parseRegistry(text: string, url: string): PluginRegistry {
	let data: PluginRegistry;
	try {
		data = JSON.parse(text) as PluginRegistry;
	} catch {
		throw new Error(
			`registry not JSON (${url}): ${text.slice(0, 80).replace(/\s+/g, ' ')}`,
		);
	}
	if (!Array.isArray(data.plugins)) {
		throw new Error('registry.plugins missing');
	}
	return data;
}

export async function fetchPluginRegistry(opts?: {
	force?: boolean;
}): Promise<PluginRegistry> {
	let url: string;
	try {
		url = registryUrl();
	} catch (e) {
		console.warn('[plugins] registry url missing', e);
		return readCache() ?? { updatedAt: new Date(0).toISOString(), plugins: [] };
	}

	try {
		const text = await fetchRegistryText(url, opts?.force);
		const data = parseRegistry(text, url);
		writeCache(data);
		return data;
	} catch (e) {
		console.warn('[plugins] registry fetch failed, using cache', e);
		return readCache() ?? { updatedAt: new Date(0).toISOString(), plugins: [] };
	}
}

/** 拉取远端原文（用于配置编辑页） */
export async function fetchPluginRegistryRawText(): Promise<string> {
	const url = registryUrl();
	const text = await fetchRegistryText(url, true);
	try {
		return `${JSON.stringify(JSON.parse(text), null, 2)}\n`;
	} catch {
		return text;
	}
}

export function clearPluginRegistryCache() {
	try {
		localStorage.removeItem(CACHE_KEY);
	} catch {
		/* ignore */
	}
	notifyPluginEnabled();
}

/** 保存前校验：hostApiRange 必须覆盖当前 Host API，避免误把 version 语义写进 hostApiRange */
export function assertRegistryHostApiCompatible(data: PluginRegistry): void {
	for (const p of data.plugins) {
		const range = p.hostApiRange?.trim();
		if (!range) {
			throw new Error(
				translateSync('plugins.registry.missingHostApiRange', { id: p.id }),
			);
		}
		if (!satisfiesRange(HOST_API_VERSION, range)) {
			throw new Error(
				translateSync('plugins.registry.hostApiIncompatible', {
					id: p.id,
					range,
					hostApi: HOST_API_VERSION,
				}),
			);
		}
	}
}

/** 将整份 registry 写回服务端 remotes，并刷新本地缓存 */
export async function savePluginRegistry(
	data: PluginRegistry,
): Promise<PluginRegistry> {
	assertRegistryHostApiCompatible(data);
	const next: PluginRegistry = {
		...data,
		updatedAt: formatRegistryUpdatedAt(),
		plugins: data.plugins,
	};
	const payload = `${JSON.stringify(next, null, 2)}\n`;
	await putUploadRemoteJson(PLUGIN_REGISTRY_FILENAME, payload);
	writeCache(next);
	return next;
}

/** 用当前账号偏好覆盖 registry 里的 enabled（仅展示/运行时，不写回服务端） */
export function overlayUserEnabled(data: PluginRegistry): PluginRegistry {
	return {
		...data,
		plugins: data.plugins.map((p) => ({
			...p,
			enabled: isPluginEnabled(p.id),
		})),
	};
}

/** 上架/下架：写入服务端账号偏好（Web/桌面同步），不改 registry catalog */
export async function persistPluginEnabled(
	id: string,
	enabled: boolean,
): Promise<PluginRegistry> {
	const data = await fetchPluginRegistry({ force: true });
	const hit = data.plugins.find((p) => p.id === id);
	if (!hit) {
		throw new Error(translateSync('plugins.registry.pluginNotFound', { id }));
	}
	await setPluginEnabledPref(id, enabled);
	notifyPluginEnabled();
	return overlayUserEnabled(data);
}
