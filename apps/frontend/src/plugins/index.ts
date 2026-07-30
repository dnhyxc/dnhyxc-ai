/** 插件运行时对外 barrel；实现按 core / inject / host / host-api 分目录 */

export {
	attachIframeBridge,
	MF_IFRAME_CHANNEL,
} from './core/attachIframeBridge';
export { createHostBridge } from './core/createHostBridge';
export {
	isPluginEnabled,
	subscribePluginEnabled,
} from './core/enabledOverrides';
export type { PluginHostSurface } from './core/hostSurface';
export { listHostSurfacePlugins } from './core/hostSurface';
export type { PluginLocaleMap } from './core/localeText';
export { pickPluginLocaleText } from './core/localeText';
export {
	fetchEntryBuildId,
	loadRemoteApp,
	pluginBust,
	registerRemote,
	resolvePluginBust,
} from './core/mf';
export { pluginManager } from './core/PluginManager';
export { satisfiesRange, verifyPlugin } from './core/PluginVerifier';
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
} from './core/registry';
export type {
	HostBridgeProps,
	LoadedPlugin,
	PluginDescriptor,
	PluginRegistry,
	PluginSidebarItem,
} from './core/types';
export { HOST_API_VERSION } from './core/types';
export { useHostSurfacePlugins } from './hooks/useHostSurfacePlugins';
export { usePluginEnabled } from './hooks/usePluginEnabled';
export { PluginErrorBoundary } from './host/PluginErrorBoundary';
export { PluginHostPage } from './host/PluginHostPage';
export { deepFreeze } from './host-api/deepFreeze';
export { eventBus } from './host-api/EventBus';
export type {
	EbookHostHandlers,
	EbookHostThought,
} from './host-api/ebookHostApi';
export {
	createEbookModulesApi,
	getEbookHostHandlers,
	setEbookHostHandlers,
} from './host-api/ebookHostApi';
export { routeInjector } from './inject/RouteInjector';
export { sidebarInjector } from './inject/SidebarInjector';
