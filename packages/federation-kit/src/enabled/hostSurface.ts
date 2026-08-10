import type { PluginDescriptor } from '../types';
import { isPluginEnabled } from './enabledOverrides';

const SURFACE_KEY = '__dnhyxc_ai_federation_surface_cache_key__';

type GlobalBag = typeof globalThis & {
	[SURFACE_KEY]?: string;
};

function getRegistryCacheKey(): string {
	return (globalThis as GlobalBag)[SURFACE_KEY] ?? 'mf.plugin.registry.v1';
}

export function configureHostSurfaceCacheKey(key: string) {
	(globalThis as GlobalBag)[SURFACE_KEY] = key;
}

export type PluginHostSurface = string;

/** 同步读 registry 缓存中声明了指定 Host surface 且已上架的插件（按 order） */
export function listHostSurfacePlugins(
	surface: PluginHostSurface,
): PluginDescriptor[] {
	try {
		const cached = localStorage.getItem(getRegistryCacheKey());
		if (!cached) return [];
		const data = JSON.parse(cached) as { plugins?: PluginDescriptor[] };
		const list = (data.plugins ?? []).filter(
			(p) => isPluginEnabled(p.id) && p.host?.surface === surface,
		);
		return list.sort((a, b) => (a.host?.order ?? 100) - (b.host?.order ?? 100));
	} catch {
		return [];
	}
}
