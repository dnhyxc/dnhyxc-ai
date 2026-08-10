/** plugins/core 对内 barrel：types / runtime / mf / bridge / registry / enabled */

export {
	attachIframeBridge,
	MF_IFRAME_CHANNEL,
} from './bridge/attachIframeBridge';
export { createHostBridge } from './bridge/createHostBridge';
export type {
	VuePluginRootProps,
	VueRemoteExpose,
	VueRemoteMount,
} from './bridge/createVueHostBridge';
export { createVueHostBridge } from './bridge/createVueHostBridge';
export {
	isPluginEnabled,
	notifyPluginEnabled,
	subscribePluginEnabled,
} from './enabled/enabledOverrides';
export type { PluginHostSurface } from './enabled/hostSurface';
export { listHostSurfacePlugins } from './enabled/hostSurface';
export {
	clearPluginEnabledPrefsCache,
	ensurePluginEnabledPrefsLoaded,
	getPluginEnabledPref,
	setPluginEnabledPref,
} from './enabled/pluginEnabledPrefs';
export {
	fetchEntryBuildId,
	loadRemoteApp,
	pluginBust,
	registerRemote,
	resolvePluginBust,
} from './mf/mf';
export type { RawRemoteModule } from './mf/normalizePluginModule';
export {
	isVueRemoteModule,
	normalizePluginModule,
} from './mf/normalizePluginModule';
export {
	assertRegistryHostApiCompatible,
	clearPluginRegistryCache,
	fetchPluginRegistry,
	fetchPluginRegistryRawText,
	formatRegistryUpdatedAt,
	overlayUserEnabled,
	PLUGIN_REGISTRY_CACHE_KEY,
	PLUGIN_REGISTRY_FILENAME,
	PLUGIN_REGISTRY_STATIC_PATH,
	persistPluginEnabled,
	savePluginRegistry,
} from './registry/registry';
export { pluginManager } from './runtime/PluginManager';
export { satisfiesRange, verifyPlugin } from './runtime/PluginVerifier';
export type {
	HostBridgeProps,
	HostLocale,
	LoadedPlugin,
	PluginDescriptor,
	PluginLocaleMap,
	PluginRegistry,
	PluginSidebarItem,
} from './types';
export { HOST_API_VERSION, pickPluginLocaleText } from './types';
