import { http, type RequestConfig } from '@/utils/fetch';
import { SETTINGS_PLUGIN_ENABLED } from './api';

export type PluginEnabledPrefsView = {
	enabledIds: string[];
};

export const getPluginEnabledPrefs = (config?: RequestConfig) =>
	http.get<PluginEnabledPrefsView>(SETTINGS_PLUGIN_ENABLED, config);

export const updatePluginEnabledPrefs = (
	body: PluginEnabledPrefsView,
	config?: RequestConfig,
) => http.put<PluginEnabledPrefsView>(SETTINGS_PLUGIN_ENABLED, body, config);
