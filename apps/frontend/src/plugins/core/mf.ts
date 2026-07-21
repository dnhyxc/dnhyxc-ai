import {
	createInstance,
	getInstance,
	type ModuleFederation,
} from '@module-federation/enhanced/runtime';
import React from 'react';
import ReactDOM from 'react-dom';
import type { PluginDescriptor, PluginModule } from './types';

let mf: ModuleFederation | null = null;
let sharedReady = false;

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

export function registerRemote(d: PluginDescriptor) {
	ensureShared();
	getMf().registerRemotes(
		[
			{
				name: remoteNameOf(d),
				entry: d.entry,
				type: 'module',
			},
		],
		{ force: true },
	);
}

export async function loadRemoteApp(
	d: PluginDescriptor,
): Promise<PluginModule> {
	ensureShared();
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
