import type { PluginRegistry } from './types';

type Listener = () => void;

/** 订阅插件启用状态变化的监听器集合 */
const listeners = new Set<Listener>();

/** 与 registry.ts CACHE_KEY 保持一致（避免循环依赖） */
const REGISTRY_CACHE_KEY = `dnhyxc.plugin.registry.${import.meta.env.PROD ? 'prod' : 'dev'}.v1`;

export function notifyPluginEnabled() {
	for (const fn of listeners) fn();
}

// 订阅插件启用状态变化
export function subscribePluginEnabled(fn: Listener) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

/**
 * 是否上架：读 registry 本地缓存中的 `enabled`（与服务端 remotes 同步后写入）。
 * 无缓存时视为未上架（保守，避免误展示入口）。
 */
export function isPluginEnabled(id: string): boolean {
	try {
		const cached = localStorage.getItem(REGISTRY_CACHE_KEY);
		if (!cached) return false;
		const data = JSON.parse(cached) as PluginRegistry;
		const p = data.plugins?.find((x) => x.id === id);
		return p?.enabled ?? false;
	} catch {
		return false;
	}
}
