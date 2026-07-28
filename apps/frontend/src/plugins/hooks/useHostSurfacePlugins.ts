import { useEffect, useState } from 'react';
import { subscribePluginEnabled } from '../core/enabledOverrides';
import {
	listHostSurfacePlugins,
	type PluginHostSurface,
} from '../core/hostSurface';
import type { PluginDescriptor } from '../core/types';

/** 订阅某 Host surface 上已声明且上架的插件列表（registry 缓存变更时刷新） */
export function useHostSurfacePlugins(
	surface: PluginHostSurface,
): PluginDescriptor[] {
	const [plugins, setPlugins] = useState(() => listHostSurfacePlugins(surface));

	useEffect(() => {
		const sync = () => setPlugins(listHostSurfacePlugins(surface));
		sync();
		return subscribePluginEnabled(sync);
	}, [surface]);

	return plugins;
}
