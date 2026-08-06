import { type ComponentType, createElement } from 'react';
import type { RouteConfig } from '@/router/routes';
import { PluginHostPage } from '../host/PluginHostPage';
import { beginPluginStyleCapture } from '../host/styleIsolation';
import { eventBus } from '../host-api/EventBus';
import { routeInjector } from '../inject/RouteInjector';
import { sidebarInjector } from '../inject/SidebarInjector';
import { createHostBridge } from './createHostBridge';
import { isPluginEnabled, notifyPluginEnabled } from './enabledOverrides';
import { loadRemoteApp, registerRemote, resolvePluginBust } from './mf';
import { verifyPlugin } from './PluginVerifier';
import { ensurePluginEnabledPrefsLoaded } from './pluginEnabledPrefs';
import { fetchPluginRegistry, persistPluginEnabled } from './registry';
import type { LoadedPlugin, PluginDescriptor } from './types';

function createPluginRoute(meta: PluginDescriptor): RouteConfig {
	const Page: ComponentType = () =>
		createElement(PluginHostPage, { pluginId: meta.id, pageShell: true });
	return {
		path: meta.routePath,
		Component: Page,
		meta: {
			/** 面包屑按当前 Host locale 从 title 解析，不绑 Host i18n key */
			titleI18n: meta.title,
			title: meta.id,
		},
	};
}

class PluginManagerImpl {
	private plugins = new Map<string, LoadedPlugin>();
	/** 同一插件并发 load 共用一个 Promise，避免失败重入闪烁 */
	private inflight = new Map<string, Promise<void>>();
	private navigateImpl: (to: string) => void = (to) => {
		window.location.assign(to);
	};

	setNavigate(fn: (to: string) => void) {
		this.navigateImpl = fn;
	}

	get(id: string) {
		return this.plugins.get(id);
	}

	list() {
		return [...this.plugins.values()];
	}

	/**
	 * 只拉 registry + 挂路由/侧栏壳，不下载 MF Remote。
	 * 实际 loadRemote 在首次 `ensurePlugin` / `PluginHostPage` 挂载时进行，避免拖慢主应用启动。
	 * `preload: 'eager'` 为显式 opt-in，仍不阻塞 init（微任务后台拉）。
	 */
	async init() {
		await ensurePluginEnabledPrefsLoaded();
		const registry = await fetchPluginRegistry({ force: true });
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

	/** 切换账号后按服务端偏好重挂/卸载壳（路由、侧栏） */
	async syncEnabledShells() {
		await ensurePluginEnabledPrefsLoaded();
		const registry = await fetchPluginRegistry();
		for (const meta of registry.plugins) {
			if (isPluginEnabled(meta.id)) this.mountShell(meta);
			else await this.unloadPlugin(meta.id);
		}
		notifyPluginEnabled();
	}

	private mountShell(meta: PluginDescriptor) {
		if (meta.injectRoute !== false) {
			routeInjector.inject(meta.id, [createPluginRoute(meta)]);
		}
		if (meta.menu) {
			sidebarInjector.add({
				pluginId: meta.id,
				path: meta.routePath,
				// 侧栏仅用 icon；nameKey 仅作稳定 id，不再指向 Host i18n
				nameKey: meta.id,
				icon: meta.menu.icon ?? 'Puzzle',
				order: meta.menu.order,
			});
		}
	}

	async ensurePlugin(id: string, opts?: { force?: boolean }) {
		const registry = await fetchPluginRegistry({ force: true });
		const meta = registry.plugins.find(
			(p) => p.id === id && isPluginEnabled(p.id),
		);
		if (!meta) {
			throw new Error(`registry 中无启用插件 ${id}`);
		}
		// bust = version@manifestHash（来自 Remote 自有 entry，不依赖改 registry）
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
			/* bust 已变，继续往下重载 */
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
			bridge: createHostBridge(meta, nav),
			mod: { default: () => null },
			status: 'loading',
			bust,
		};
		this.plugins.set(meta.id, loading);

		try {
			await verifyPlugin(meta);

			// untrusted：仅激活壳，由 PluginHostPage 渲染 iframe，不进 MF
			if (meta.trust === 'untrusted') {
				this.plugins.set(meta.id, {
					meta,
					bridge: createHostBridge(meta, nav),
					mod: { default: () => null },
					status: 'activated',
					bust,
				});
				return;
			}

			registerRemote(meta, bust);
			const endCapture = beginPluginStyleCapture(meta.id, meta.entry);
			let mod: Awaited<ReturnType<typeof loadRemoteApp>>;
			try {
				mod = await loadRemoteApp(meta);
			} finally {
				endCapture();
			}
			const bridge = createHostBridge(meta, nav);
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
			routeInjector.remove(id);
			sidebarInjector.remove(id);
			return;
		}
		try {
			await loaded.mod.deactivate?.();
		} catch (e) {
			console.error(`[PluginManager] deactivate ${id}`, e);
		}
		eventBus.clearPlugin(id);
		routeInjector.remove(id);
		sidebarInjector.remove(id);
		this.plugins.set(id, {
			...loaded,
			status: 'unloaded',
		});
	}

	/**
	 * 上架 / 下架：写入服务端账号偏好（Web/桌面同步），并即时挂壳或卸载。
	 * 下架后业务入口配合 `usePluginEnabled` 隐藏。
	 */
	async setEnabled(id: string, enabled: boolean) {
		const registry = await persistPluginEnabled(id, enabled);
		if (!enabled) {
			await this.unloadPlugin(id);
			return;
		}
		const meta = registry.plugins.find((p) => p.id === id && p.enabled);
		if (!meta) return;
		this.mountShell(meta);
	}
}

export const pluginManager = new PluginManagerImpl();
