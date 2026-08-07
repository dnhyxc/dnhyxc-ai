import {
	createInstance,
	getInstance,
	type ModuleFederation,
	type ModuleFederationRuntimePlugin,
} from '@module-federation/enhanced/runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import type { PluginDescriptor, PluginModule } from './types';

let mf: ModuleFederation | null = null;
let sharedReady = false;
let bustPluginReady = false;

/** remoteName → bust token；afterResolve 给改写后的 remoteEntry.js 补上 */
const bustByRemote = new Map<string, string>();
/**
 * registry entry（通常 mf-manifest.json）→ 解析出的 remoteEntry.js 绝对地址。
 * resolvePluginBust 拉 manifest 时写入，registerRemote 直接注册 remoteEntry，避免 MF 再拉一次 manifest。
 */
const remoteEntryByManifest = new Map<string, string>();

function entryKey(entry: string): string {
	try {
		const u = new URL(entry);
		u.search = '';
		u.hash = '';
		return u.href;
	} catch {
		return entry;
	}
}

/** 从 manifest 正文 / entry URL 得到 remoteEntry.js 绝对地址 */
function resolveRemoteEntryUrl(entry: string, manifestText: string): string {
	try {
		const json = JSON.parse(manifestText) as {
			metaData?: { publicPath?: string; remoteEntry?: { name?: string } };
		};
		const file = json.metaData?.remoteEntry?.name?.trim() || 'remoteEntry.js';
		const publicPath = json.metaData?.publicPath?.trim();
		if (publicPath) return new URL(file, publicPath).href;
	} catch {
		/* 非 JSON 或结构异常：按 entry 路径回退 */
	}
	try {
		const u = new URL(entry);
		if (/remoteEntry\.js$/i.test(u.pathname)) {
			u.search = '';
			u.hash = '';
			return u.href;
		}
		u.pathname = u.pathname.replace(/[^/]*$/, 'remoteEntry.js');
		u.search = '';
		u.hash = '';
		return u.href;
	} catch {
		return entry;
	}
}

/**
 * MF 一律走 WebView 原生 fetch/import（不走 plugin-http）。
 * 这样第三方插件域名不必写进 capabilities；对方 Nginx 对
 * `https://dnhyxc.cn:9002` + `tauri://localhost` 开 CORS 即可，加插件不发桌面版。
 */
function getMf(): ModuleFederation {
	if (mf) return mf;
	try {
		const existing = getInstance();
		if (existing) {
			mf = existing;
			return mf;
		}
	} catch {
		/* no default instance yet */
	}
	mf = createInstance({ name: 'host', remotes: [] });
	return mf;
}

/** 给任意 URL 写入/覆盖 `v=`（manifest 与 remoteEntry 共用） */
export function withBust(url: string, bust: string): string {
	const token = bust.trim();
	if (!token) return url;
	try {
		const u = new URL(url);
		u.searchParams.set('v', token);
		return u.href;
	} catch {
		const hashIdx = url.indexOf('#');
		const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
		const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
		const qIdx = noHash.indexOf('?');
		const base = qIdx >= 0 ? noHash.slice(0, qIdx) : noHash;
		const params = new URLSearchParams(qIdx >= 0 ? noHash.slice(qIdx + 1) : '');
		params.set('v', token);
		return `${base}?${params.toString()}${hash}`;
	}
}

export function pluginBust(
	meta: Pick<PluginDescriptor, 'version'>,
	/** Remote 构建指纹（manifest hash）；勿用 registry.updatedAt，避免发布者改 Host 清单 */
	buildId?: string,
): string {
	return [meta.version.trim(), buildId?.trim()].filter(Boolean).join('@');
}

/** FNV-1a 32-bit；仅作 cache bust，非安全哈希 */
function hashText(text: string): string {
	let h = 2166136261;
	for (let i = 0; i < text.length; i++) {
		h ^= text.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0).toString(16);
}

/**
 * 拉取 Remote 自有的 mf-manifest（仅此一次网络请求）：
 * - 内容指纹 → bust
 * - 解析 remoteEntry 绝对地址 → 供 registerRemote 直连，MF 不再二次拉 manifest
 */
async function fetchManifestMeta(
	entry: string,
): Promise<{ buildId: string; remoteEntryUrl: string }> {
	const url = withBust(entry, `t${Date.now()}`);
	const res = await fetch(url, { cache: 'no-store' });
	if (!res.ok) {
		throw new Error(`entry buildId ${res.status}: ${entry}`);
	}
	const text = await res.text();
	const remoteEntryUrl = resolveRemoteEntryUrl(entry, text);
	remoteEntryByManifest.set(entryKey(entry), remoteEntryUrl);
	return { buildId: hashText(text), remoteEntryUrl };
}

/**
 * 拉取 Remote 自有的 mf-manifest，用内容指纹做 bust。
 * 发布者只更新自己域名上的静态资源即可；无需也不应改 Host registry。
 */
export async function fetchEntryBuildId(entry: string): Promise<string> {
	const { buildId } = await fetchManifestMeta(entry);
	return buildId;
}

/** trusted MF：version@manifestHash；untrusted：仅 version（iframe 不走 MF entry） */
export async function resolvePluginBust(
	meta: Pick<PluginDescriptor, 'version' | 'entry' | 'trust'>,
): Promise<string> {
	if (meta.trust === 'untrusted') {
		return pluginBust(meta);
	}
	const { buildId } = await fetchManifestMeta(meta.entry);
	return pluginBust(meta, buildId);
}

/**
 * snapshot 插件会把 entry 改写成无 query 的 `.../remoteEntry.js`，
 * WKWebView 会对固定名 ESM 强缓存。本钩子在改写之后补 bust。
 */
const bustRemoteEntryPlugin: ModuleFederationRuntimePlugin = {
	name: 'bust-remote-entry',
	async afterResolve(args) {
		const name = args.remoteInfo?.name;
		const bust = name ? bustByRemote.get(name) : undefined;
		// args.remoteInfo?.entry 为 http://127.0.0.1:9008/remoteEntry.js
		if (bust && args.remoteInfo?.entry) {
			// 给 http://127.0.0.1:9008/remoteEntry.js 加上 ?v=1.2.0
			// 返回 http://127.0.0.1:9008/remoteEntry.js?v=1.2.0
			args.remoteInfo.entry = withBust(args.remoteInfo.entry, bust);
		}
		return args;
	},
};

function ensureBustPlugin() {
	if (bustPluginReady) return;
	getMf().registerPlugins([bustRemoteEntryPlugin]);
	bustPluginReady = true;
}

function ensureShared() {
	if (sharedReady) return;
	const instance = getMf();
	instance.registerShared({
		react: {
			version: React.version,
			scope: 'default',
			get: async () => () => React,
			shareConfig: {
				singleton: true,
				requiredVersion: `^${React.version}`,
			},
		},
		'react-dom': {
			version: ReactDOM.version || React.version,
			scope: 'default',
			get: async () => () => ReactDOM,
			shareConfig: {
				singleton: true,
				requiredVersion: `^${ReactDOM.version || React.version}`,
			},
		},
	});
	sharedReady = true;
}

function remoteNameOf(d: PluginDescriptor) {
	return d.remoteName?.trim() || d.id;
}

/** `./IdeasList` → `IdeasList` */
function exposeBaseOf(d: PluginDescriptor) {
	const raw = (d.expose?.trim() || './App').replace(/^\.\//, '');
	return raw || 'App';
}

export function registerRemote(d: PluginDescriptor, bust?: string) {
	ensureShared();
	ensureBustPlugin();
	const token = (bust ?? d.version).trim();
	const name = remoteNameOf(d);
	if (token) bustByRemote.set(name, token);
	/* 优先用 resolvePluginBust 已解析的 remoteEntry，跳过 MF 对 mf-manifest 的第二次请求 */
	const remoteEntry =
		remoteEntryByManifest.get(entryKey(d.entry)) ??
		resolveRemoteEntryUrl(d.entry, '');
	getMf().registerRemotes(
		[
			{
				name,
				entry: withBust(remoteEntry, token),
				type: 'module',
			},
		],
		{ force: true },
	);
}

export async function loadRemoteApp(
	d: PluginDescriptor,
): Promise<PluginModule> {
	// 在加载插件之前，确保 shared 和 bust 插件已注册
	ensureShared();
	// 确保 bust 插件已注册
	ensureBustPlugin();
	const name = remoteNameOf(d);
	const expose = exposeBaseOf(d);
	const mod = await getMf().loadRemote<PluginModule>(`${name}/${expose}`);
	if (!mod?.default) {
		throw new Error(
			`plugin ${d.id}: expose ./${expose} missing default export`,
		);
	}
	return mod;
}
