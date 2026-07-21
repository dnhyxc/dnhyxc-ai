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
export { loadRemoteApp, registerRemote } from './core/mf';
export { pluginManager } from './core/PluginManager';
export { satisfiesRange, verifyPlugin } from './core/PluginVerifier';
export {
	clearPluginRegistryCache,
	fetchPluginRegistry,
	fetchPluginRegistryRawText,
	formatRegistryUpdatedAt,
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
