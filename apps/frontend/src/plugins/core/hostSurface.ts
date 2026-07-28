import type { PluginDescriptor } from './types';

const REGISTRY_CACHE_KEY = `dnhyxc.plugin.registry.${import.meta.env.PROD ? 'prod' : 'dev'}.v1`;

export type PluginHostSurface = NonNullable<
	PluginDescriptor['host']
>['surface'];

/** 同步读 registry 缓存中声明了指定 Host surface 且已上架的插件（按 order） */
export function listHostSurfacePlugins(
	surface: PluginHostSurface,
): PluginDescriptor[] {
	try {
		const cached = localStorage.getItem(REGISTRY_CACHE_KEY);
		if (!cached) return [];
		const data = JSON.parse(cached) as { plugins?: PluginDescriptor[] };
		const list = (data.plugins ?? []).filter(
			(p) => p.enabled && p.host?.surface === surface,
		);
		return list.sort((a, b) => (a.host?.order ?? 100) - (b.host?.order ?? 100));
	} catch {
		return [];
	}
}
