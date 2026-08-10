import { useEffect, useState } from 'react';
import {
	isEnabledPrefsReady,
	isPluginEnabled,
	subscribePluginEnabled,
} from '../enabled/enabledOverrides';

export type PluginEnabledState = {
	enabled: boolean;
	/** false：偏好尚未拉取，勿展示「已下架」 */
	ready: boolean;
};

export function usePluginEnabledState(pluginId: string): PluginEnabledState {
	const [state, setState] = useState<PluginEnabledState>(() => ({
		enabled: isPluginEnabled(pluginId),
		ready: isEnabledPrefsReady(),
	}));

	useEffect(() => {
		const sync = () =>
			setState({
				enabled: isPluginEnabled(pluginId),
				ready: isEnabledPrefsReady(),
			});
		sync();
		return subscribePluginEnabled(sync);
	}, [pluginId]);

	return state;
}

export function usePluginEnabled(pluginId: string): boolean {
	return usePluginEnabledState(pluginId).enabled;
}
