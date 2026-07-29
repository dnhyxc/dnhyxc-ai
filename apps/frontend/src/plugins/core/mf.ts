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
	registryUpdatedAt?: string,
): string {
	return [meta.version.trim(), registryUpdatedAt?.trim()]
		.filter(Boolean)
		.join('@');
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
	getMf().registerRemotes(
		[
			{
				name,
				entry: withBust(d.entry, token),
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
