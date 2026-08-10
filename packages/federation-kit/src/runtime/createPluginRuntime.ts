import type { ComponentType, ReactNode } from 'react';
import { createElement } from 'react';
import { createHostBridge } from '../bridge/createHostBridge';
import type { PluginHostConfig } from '../config/types';
import {
	configureEnabledGetter,
	configureEnabledReady,
	isPluginEnabled,
	notifyPluginEnabled,
} from '../enabled/enabledOverrides';
import { configureHostSurfaceCacheKey } from '../enabled/hostSurface';
import { eventBus } from '../host-api/EventBus';
import {
	createRouteInjector,
	type RouteInjector,
} from '../inject/RouteInjector';
import {
	type SidebarInjector,
	sidebarInjector,
} from '../inject/SidebarInjector';
import { loadRemoteApp, registerRemote, resolvePluginBust } from '../mf/mf';
import {
	beginPluginStyleCapture,
	configureStyleIsolation,
} from '../style-isolation';
import type { LoadedPlugin, PluginDescriptor } from '../types';
import { configureVerifyEnv, verifyPlugin } from './PluginVerifier';

export type PluginRouteFactory<TRoute extends { path?: string }> = (
	meta: PluginDescriptor,
) => TRoute;

export class PluginManager<
	TRoute extends { path?: string } = { path?: string },
> {
	private plugins = new Map<string, LoadedPlugin>();
	private inflight = new Map<string, Promise<void>>();
	private navigateImpl: (to: string) => void;
	readonly routeInjector: RouteInjector<TRoute>;
	readonly sidebarInjector: SidebarInjector = sidebarInjector;
	private readonly config: PluginHostConfig;
	private readonly createRoute: PluginRouteFactory<TRoute> | undefined;

	constructor(
		config: PluginHostConfig,
		opts?: {
			routeInjector?: RouteInjector<TRoute>;
			createRoute?: PluginRouteFactory<TRoute>;
		},
	) {
		this.config = config;
		this.navigateImpl = config.capabilities.navigate;
		this.routeInjector = opts?.routeInjector ?? createRouteInjector<TRoute>();
		this.createRoute = opts?.createRoute;
	}

	setNavigate(fn: (to: string) => void) {
		this.navigateImpl = fn;
	}

	get(id: string) {
		return this.plugins.get(id);
	}

	list() {
		return [...this.plugins.values()];
	}

	async init() {
		await this.config.enabledStore.load?.();
		const registry = await this.config.fetchRegistry({ force: true });
		const enabled = registry.plugins.filter((p) => isPluginEnabled(p.id));
		for (const meta of enabled) {
			this.mountShell(meta);
		}
		const eager = enabled.filter((p) => p.preload === 'eager');
		if (eager.length === 0) return;
		queueMicrotask(() => {
			void Promise.all(eager.map((p) => this.loadPlugin(p)));
		});
	}

	async syncEnabledShells() {
		await this.config.enabledStore.load?.();
		const registry = await this.config.fetchRegistry();
		for (const meta of registry.plugins) {
			if (isPluginEnabled(meta.id)) this.mountShell(meta);
			else await this.unloadPlugin(meta.id);
		}
		notifyPluginEnabled();
	}

	private mountShell(meta: PluginDescriptor) {
		if (meta.injectRoute !== false && this.createRoute) {
			this.routeInjector.inject(meta.id, [this.createRoute(meta)]);
		}
		if (meta.menu) {
			this.sidebarInjector.add({
				pluginId: meta.id,
				path: meta.routePath,
				nameKey: meta.id,
				icon: meta.menu.icon ?? 'Puzzle',
				order: meta.menu.order,
			});
		}
	}

	async ensurePlugin(id: string, opts?: { force?: boolean }) {
		await this.config.enabledStore.load?.();
		const registry = await this.config.fetchRegistry({ force: true });
		const meta = registry.plugins.find(
			(p) => p.id === id && isPluginEnabled(p.id),
		);
		if (!meta) {
			throw new Error(`registry 中无启用插件 ${id}`);
		}
		const bust = await resolvePluginBust(meta);
		const cur = this.plugins.get(id);
		if (cur?.status === 'activated' && cur.bust === bust && !opts?.force) {
			return cur;
		}
		if (cur?.status === 'failed' && !opts?.force && cur.bust === bust) {
			throw new Error(cur.error || `加载 ${id} 失败`);
		}

		const pending = this.inflight.get(id);
		if (pending && !opts?.force) {
			await pending;
			const after = this.plugins.get(id);
			if (after?.status === 'activated' && after.bust === bust) return after;
			if (after?.status !== 'activated') {
				throw new Error(after?.error || `加载 ${id} 失败`);
			}
		}

		this.mountShell(meta);
		await this.loadPlugin(meta, opts, bust);
		const next = this.plugins.get(id);
		if (next?.status !== 'activated') {
			throw new Error(next?.error || `加载 ${id} 失败`);
		}
		return next;
	}

	async loadPlugin(
		meta: PluginDescriptor,
		opts?: { force?: boolean },
		bustToken?: string,
	) {
		const bust = bustToken ?? (await resolvePluginBust(meta));
		const prev = this.plugins.get(meta.id);
		if (prev?.status === 'activated' && prev.bust === bust && !opts?.force) {
			return;
		}
		if (prev?.status === 'activated') {
			await this.unloadPlugin(meta.id);
			this.mountShell(meta);
		}

		const existing = this.inflight.get(meta.id);
		if (existing) {
			if (!opts?.force) return existing;
			await existing.catch(() => {});
		}

		const run = this.runLoad(meta, bust);
		this.inflight.set(meta.id, run);
		try {
			await run;
		} finally {
			if (this.inflight.get(meta.id) === run) {
				this.inflight.delete(meta.id);
			}
		}
	}

	private async runLoad(meta: PluginDescriptor, bust: string) {
		const nav = (to: string) => this.navigateImpl(to);
		const loading: LoadedPlugin = {
			meta,
			bridge: createHostBridge(meta, this.config.capabilities, nav),
			mod: { default: () => null },
			status: 'loading',
			bust,
		};
		this.plugins.set(meta.id, loading);

		try {
			await verifyPlugin(meta);

			if (meta.trust === 'untrusted') {
				this.plugins.set(meta.id, {
					meta,
					bridge: createHostBridge(meta, this.config.capabilities, nav),
					mod: { default: () => null },
					status: 'activated',
					bust,
				});
				return;
			}

			registerRemote(meta, bust);
			const endCapture = beginPluginStyleCapture(
				meta.id,
				meta.entry,
				meta.remoteName,
			);
			let mod: Awaited<ReturnType<typeof loadRemoteApp>>;
			try {
				mod = await loadRemoteApp(meta);
			} finally {
				endCapture();
			}
			const bridge = createHostBridge(meta, this.config.capabilities, nav);
			await mod.activate?.(bridge.api);

			this.plugins.set(meta.id, {
				meta,
				bridge,
				mod,
				status: 'activated',
				bust,
			});
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e);
			console.error(`[PluginManager] load ${meta.id} failed`, e);
			this.plugins.set(meta.id, {
				...loading,
				status: 'failed',
				error: message,
			});
		}
	}

	async unloadPlugin(id: string) {
		const loaded = this.plugins.get(id);
		if (!loaded) {
			this.routeInjector.remove(id);
			this.sidebarInjector.remove(id);
			return;
		}
		try {
			await loaded.mod.deactivate?.();
		} catch (e) {
			console.error(`[PluginManager] deactivate ${id}`, e);
		}
		eventBus.clearPlugin(id);
		this.routeInjector.remove(id);
		this.sidebarInjector.remove(id);
		this.plugins.set(id, {
			...loaded,
			status: 'unloaded',
		});
	}

	async setEnabled(id: string, enabled: boolean) {
		const persist =
			this.config.persistEnabled ??
			(async (pluginId, on) => {
				await this.config.enabledStore.set?.(pluginId, on);
				notifyPluginEnabled();
				return this.config.fetchRegistry({ force: true });
			});
		const registry = await persist(id, enabled);
		if (!enabled) {
			await this.unloadPlugin(id);
			return;
		}
		const meta = registry.plugins.find((p) => p.id === id && p.enabled);
		if (!meta) return;
		this.mountShell(meta);
	}
}

export type PluginRuntime<
	TRoute extends { path?: string } = { path?: string },
> = {
	config: PluginHostConfig;
	manager: PluginManager<TRoute>;
	routeInjector: RouteInjector<TRoute>;
	sidebarInjector: SidebarInjector;
	init: () => Promise<void>;
	hostApiVersion: string;
};

export function createPluginRuntime<
	TRoute extends { path?: string } = { path?: string },
>(
	config: PluginHostConfig,
	opts?: {
		routeInjector?: RouteInjector<TRoute>;
		createRoute?: PluginRouteFactory<TRoute>;
		/** 默认 createElement 包装；若提供 createRoute 优先 */
		HostPage?: ComponentType<{ pluginId: string; pageShell?: boolean }>;
	},
): PluginRuntime<TRoute> {
	const hostApiVersion = config.hostApiVersion?.trim() || '1.0.0';
	const prod =
		config.prod ??
		(typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');
	const skipIntegrity = config.skipIntegrity ?? true;
	const storagePrefix = config.storagePrefix ?? 'mf.plugin';

	configureVerifyEnv({
		hostApiVersion,
		prod,
		skipIntegrity,
		translate: config.translate,
	});
	configureEnabledGetter((id) => config.enabledStore.get(id));
	configureEnabledReady(() => config.enabledStore.isReady?.() ?? true);
	configureHostSurfaceCacheKey(
		config.registryCacheKey ?? `${storagePrefix}.registry.v1`,
	);
	configureStyleIsolation(config.styleIsolation);

	let createRoute = opts?.createRoute;
	if (!createRoute && opts?.HostPage) {
		const Page = opts.HostPage;
		createRoute = (meta) =>
			({
				path: meta.routePath,
				Component: (() =>
					createElement(Page, {
						pluginId: meta.id,
						pageShell: true,
					})) as ComponentType,
				meta: {
					titleI18n: meta.title,
					title: meta.id,
				},
			}) as unknown as TRoute;
	}

	const manager = new PluginManager(config, {
		routeInjector: opts?.routeInjector,
		createRoute,
	});

	return {
		config,
		manager,
		routeInjector: manager.routeInjector,
		sidebarInjector: manager.sidebarInjector,
		init: () => manager.init(),
		hostApiVersion,
	};
}

/** 供 Host 路由工厂使用的默认页类型占位 */
export type { ReactNode };
