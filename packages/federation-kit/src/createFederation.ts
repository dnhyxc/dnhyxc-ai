import type { ComponentType } from 'react';
import type {
	EnabledStore,
	HostCapabilities,
	HostHttpClient,
	HostTheme,
	PluginHostConfig,
	StyleIsolationConfig,
} from './config/types';
import { notifyPluginEnabled } from './enabled/enabledOverrides';
import type { RouteInjector } from './inject/RouteInjector';
import type { SidebarInjector } from './inject/SidebarInjector';
import { readRegistryCache, writeRegistryCache } from './registry/cache';
import {
	createPluginRuntime,
	type PluginManager,
	type PluginRouteFactory,
	type PluginRuntime,
} from './runtime/createPluginRuntime';
import type { HostBridgeProps, HostLocale, PluginRegistry } from './types';

/** 避免循环：本文件只依赖类型与运行时，registry 读写内联 */

function defaultTheme(): HostTheme {
	try {
		const t = document.documentElement.getAttribute('data-theme');
		if (t === 'dark' || t === 'light') return t;
		if (
			document.documentElement.classList.contains('dark') ||
			document.body.classList.contains('dark')
		) {
			return 'dark';
		}
	} catch {
		/* ignore */
	}
	return 'light';
}

function createLocalEnabledStore(prefix: string): EnabledStore {
	const key = `${prefix}.enabled.v1`;
	const read = (): Record<string, boolean> => {
		try {
			return JSON.parse(localStorage.getItem(key) || '{}') as Record<
				string,
				boolean
			>;
		} catch {
			return {};
		}
	};
	return {
		get: (id) => read()[id] === true,
		set: (id, on) => {
			const next = { ...read(), [id]: on };
			if (!on) delete next[id];
			else next[id] = true;
			localStorage.setItem(key, JSON.stringify(next));
			notifyPluginEnabled();
		},
	};
}

async function fetchRegistryFromUrl(
	url: string,
	cacheKey: string,
	opts?: { force?: boolean },
): Promise<PluginRegistry> {
	const bust = opts?.force
		? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
		: url;
	try {
		const res = await fetch(bust, { cache: 'no-store' });
		if (!res.ok) throw new Error(`registry ${res.status}`);
		const data = (await res.json()) as PluginRegistry;
		if (!Array.isArray(data.plugins))
			throw new Error('registry.plugins missing');
		writeRegistryCache(cacheKey, data);
		return data;
	} catch (e) {
		console.warn('[federation-kit] registry fetch failed, using cache', e);
		return (
			readRegistryCache(cacheKey) ?? {
				updatedAt: new Date(0).toISOString(),
				plugins: [],
			}
		);
	}
}

export type CreateFederationOptions<
	TRoute extends { path?: string } = { path?: string },
> = {
	/**
	 * 最简接入：registry JSON 地址（kit 自行 fetch + 缓存）。
	 * 与 `fetchRegistry` 二选一；都缺省则空 registry。
	 */
	registryUrl?: string;
	fetchRegistry?: PluginHostConfig['fetchRegistry'];
	hostApiVersion?: string;
	prod?: boolean;
	skipIntegrity?: boolean;
	storagePrefix?: string;
	registryCacheKey?: string;
	iframeChannel?: string;
	enabledStore?: EnabledStore;
	persistEnabled?: PluginHostConfig['persistEnabled'];
	/** 覆盖默认 capabilities；未给的字段用内置默认 */
	capabilities?: Partial<HostCapabilities>;
	styleIsolation?: StyleIsolationConfig;
	iframeRpcHandlers?: PluginHostConfig['iframeRpcHandlers'];
	translate?: PluginHostConfig['translate'];
	createRoute?: PluginRouteFactory<TRoute>;
	HostPage?: ComponentType<{ pluginId: string; pageShell?: boolean }>;
	routeInjector?: RouteInjector<TRoute>;
	/** 设为默认单例，供 `<Plugin />` 无 Context 使用；默认 true */
	asDefault?: boolean;
};

export type FederationHost<
	TRoute extends { path?: string } = { path?: string },
> = {
	/** 拉 registry、挂路由/侧栏壳（≈ qiankun start） */
	start: () => Promise<void>;
	runtime: PluginRuntime<TRoute>;
	manager: PluginManager<TRoute>;
	routeInjector: RouteInjector<TRoute>;
	sidebarInjector: SidebarInjector;
	setNavigate: (fn: (to: string) => void) => void;
	/** 路由注入变化时回调（用来重建 router） */
	onRoutesChange: (fn: () => void) => () => void;
	getIframeBridgeOptions: () => {
		channel?: string;
		getLocale: () => HostLocale | string;
		onLocaleChange?: (handler: (locale: HostLocale) => void) => () => void;
		extraRpc?: Record<
			string,
			(bridge: HostBridgeProps, args: unknown[]) => unknown | Promise<unknown>
		>;
	};
	config: PluginHostConfig;
};

const DEFAULT_HOST_KEY = '__dnhyxc_ai_federation_default__';

type GlobalFederationBag = typeof globalThis & {
	[DEFAULT_HOST_KEY]?: FederationHost | null;
};

let defaultFederation: FederationHost | null = null;

export function getDefaultFederation(): FederationHost | null {
	if (defaultFederation) return defaultFederation;
	// 跨入口（`.` / `./react`）双份打包时用 globalThis 共享单例
	return (globalThis as GlobalFederationBag)[DEFAULT_HOST_KEY] ?? null;
}

export function setDefaultFederation(host: FederationHost | null) {
	defaultFederation = host;
	(globalThis as GlobalFederationBag)[DEFAULT_HOST_KEY] = host;
}

/**
 * 主流式接入入口（qiankun `start` 风格）。
 *
 * @example
 * ```ts
 * const mf = createFederation({ registryUrl: '/remotes/plugins-registry.json' });
 * await mf.start();
 * mf.setNavigate((to) => router.navigate(to));
 * ```
 */
export function createFederation<
	TRoute extends { path?: string } = { path?: string },
>(options: CreateFederationOptions<TRoute> = {}): FederationHost<TRoute> {
	const storagePrefix = options.storagePrefix ?? 'mf.plugin';
	const registryCacheKey =
		options.registryCacheKey ?? `${storagePrefix}.registry.v1`;
	const enabledStore =
		options.enabledStore ?? createLocalEnabledStore(storagePrefix);

	const fetchRegistry =
		options.fetchRegistry ??
		(options.registryUrl
			? (opts?: { force?: boolean }) =>
					fetchRegistryFromUrl(options.registryUrl!, registryCacheKey, opts)
			: async () =>
					readRegistryCache(registryCacheKey) ?? {
						updatedAt: new Date(0).toISOString(),
						plugins: [],
					});

	const userCaps = options.capabilities ?? {};
	const capabilities: HostCapabilities = {
		getTheme: userCaps.getTheme ?? defaultTheme,
		getLocale: userCaps.getLocale ?? (() => 'zh-CN'),
		navigate: userCaps.navigate ?? ((to: string) => window.location.assign(to)),
		toast: userCaps.toast,
		http: userCaps.http,
		downloadBlob: userCaps.downloadBlob,
		setAppFullscreen: userCaps.setAppFullscreen,
		pickLocalFiles: userCaps.pickLocalFiles,
		modules: userCaps.modules,
		buildModules: userCaps.buildModules,
		onLocaleChange: userCaps.onLocaleChange,
	};

	const config: PluginHostConfig = {
		hostApiVersion: options.hostApiVersion,
		prod: options.prod,
		skipIntegrity: options.skipIntegrity,
		storagePrefix,
		registryCacheKey,
		iframeChannel: options.iframeChannel ?? 'mf-iframe',
		fetchRegistry,
		persistEnabled: options.persistEnabled,
		enabledStore,
		capabilities,
		styleIsolation: options.styleIsolation,
		iframeRpcHandlers: options.iframeRpcHandlers,
		translate: options.translate,
	};

	const runtime = createPluginRuntime<TRoute>(config, {
		createRoute: options.createRoute,
		HostPage: options.HostPage,
		routeInjector: options.routeInjector,
	});

	const host: FederationHost<TRoute> = {
		start: () => runtime.init(),
		runtime,
		manager: runtime.manager,
		routeInjector: runtime.routeInjector,
		sidebarInjector: runtime.sidebarInjector,
		setNavigate: (fn) => runtime.manager.setNavigate(fn),
		onRoutesChange: (fn) => runtime.routeInjector.subscribe(fn),
		getIframeBridgeOptions: () => ({
			channel: config.iframeChannel,
			getLocale: () => capabilities.getLocale(),
			onLocaleChange: capabilities.onLocaleChange,
			extraRpc: config.iframeRpcHandlers,
		}),
		config,
	};

	if (options.asDefault !== false) {
		setDefaultFederation(host as FederationHost);
	}

	return host;
}

/** 便捷：仅 URL 即可创建（等同 createFederation({ registryUrl })） */
export function createFederationFromUrl(
	registryUrl: string,
	opts?: Omit<CreateFederationOptions, 'registryUrl'>,
) {
	return createFederation({ ...opts, registryUrl });
}

export type { HostHttpClient };
