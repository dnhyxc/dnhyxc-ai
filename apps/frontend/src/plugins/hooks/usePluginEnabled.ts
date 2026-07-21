import { useEffect, useState } from 'react';
import {
	isPluginEnabled,
	subscribePluginEnabled,
} from '../core/enabledOverrides';

/** 订阅 registry 上架状态（缓存），用于业务入口条件渲染 */
export function usePluginEnabled(pluginId: string): boolean {
	const [enabled, setEnabled] = useState(() => isPluginEnabled(pluginId));

	useEffect(() => {
		const sync = () => setEnabled(isPluginEnabled(pluginId));
		sync();
		return subscribePluginEnabled(sync);
	}, [pluginId]);

	return enabled;
}
