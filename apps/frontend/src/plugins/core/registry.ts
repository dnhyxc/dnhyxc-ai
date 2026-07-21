import { putUploadRemoteJson } from '@/service';
import { getPlatformFetch } from '@/utils/fetch';
import { resolveUploadedFileUrl } from '@/utils/upload-file-url';
import { notifyPluginEnabled } from './enabledOverrides';
import type { PluginRegistry } from './types';

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

async function fetchRegistryText(
	url: string,
	force?: boolean,
): Promise<string> {
	const doFetch = /^https?:\/\//i.test(url)
		? await getPlatformFetch()
		: globalThis.fetch.bind(globalThis);
	const res = await doFetch(url, {
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
	const text = await fetchRegistryText(url);
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

/** 将整份 registry 写回服务端 remotes，并刷新本地缓存 */
export async function savePluginRegistry(
	data: PluginRegistry,
): Promise<PluginRegistry> {
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

/** 上架/下架：改 plugins[].enabled 并持久化到 plugins-registry.json */
export async function persistPluginEnabled(
	id: string,
	enabled: boolean,
): Promise<PluginRegistry> {
	const data = await fetchPluginRegistry({ force: true });
	const hit = data.plugins.find((p) => p.id === id);
	if (!hit) throw new Error(`registry 中无插件 ${id}`);
	if (hit.enabled === enabled) {
		writeCache(data);
		return data;
	}
	return savePluginRegistry({
		...data,
		plugins: data.plugins.map((p) => (p.id === id ? { ...p, enabled } : p)),
	});
}
