/** 插件运行时对外 barrel；实现按 core / inject / host / host-api / style-isolation 分目录 */

export type {
	HostBridgeProps,
	LoadedPlugin,
	PluginDescriptor,
	PluginHostSurface,
	PluginLocaleMap,
	PluginRegistry,
	PluginSidebarItem,
	RawRemoteModule,
	VuePluginRootProps,
	VueRemoteExpose,
	VueRemoteMount,
} from './core';
export {
	assertRegistryHostApiCompatible,
	attachIframeBridge,
	clearPluginRegistryCache,
	createHostBridge,
	createVueHostBridge,
	fetchEntryBuildId,
	fetchPluginRegistry,
	fetchPluginRegistryRawText,
	formatRegistryUpdatedAt,
	HOST_API_VERSION,
	isPluginEnabled,
	isVueRemoteModule,
	listHostSurfacePlugins,
	loadRemoteApp,
	MF_IFRAME_CHANNEL,
	normalizePluginModule,
	overlayUserEnabled,
	PLUGIN_REGISTRY_CACHE_KEY,
	PLUGIN_REGISTRY_FILENAME,
	PLUGIN_REGISTRY_STATIC_PATH,
	persistPluginEnabled,
	pickPluginLocaleText,
	pluginBust,
	pluginManager,
	registerRemote,
	resolvePluginBust,
	satisfiesRange,
	savePluginRegistry,
	subscribePluginEnabled,
	verifyPlugin,
} from './core';
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
export {
	claimPluginPortalTarget,
	clearPluginPortalClaim,
	styleRealmKey,
} from './style-isolation';
