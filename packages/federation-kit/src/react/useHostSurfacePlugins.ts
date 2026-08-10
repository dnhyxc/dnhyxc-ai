import { useEffect, useState } from 'react';
import { subscribePluginEnabled } from '../enabled/enabledOverrides';
import {
	listHostSurfacePlugins,
	type PluginHostSurface,
} from '../enabled/hostSurface';
import type { PluginDescriptor } from '../types';

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
