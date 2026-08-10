export {
	type AttachIframeBridgeOptions,
	attachIframeBridge,
	DEFAULT_MF_IFRAME_CHANNEL,
	MF_IFRAME_CHANNEL,
} from './bridge/attachIframeBridge';
export { createHostBridge } from './bridge/createHostBridge';
export {
	createVueHostBridge,
	type VuePluginRootProps,
	type VueRemoteExpose,
	type VueRemoteMount,
} from './bridge/createVueHostBridge';
export type {
	EnabledStore,
	HostCapabilities,
	HostHttpClient,
	HostTheme,
	PluginHostConfig,
	PluginRouteSpec,
	StyleIsolationConfig,
} from './config/types';
export {
	type CreateFederationOptions,
	createFederation,
	createFederationFromUrl,
	type FederationHost,
	getDefaultFederation,
	setDefaultFederation,
} from './createFederation';

export {
	configureEnabledGetter,
	configureEnabledReady,
	isEnabledPrefsReady,
	isPluginEnabled,
	notifyPluginEnabled,
	subscribePluginEnabled,
} from './enabled/enabledOverrides';
export {
	configureHostSurfaceCacheKey,
	listHostSurfacePlugins,
	type PluginHostSurface,
} from './enabled/hostSurface';

export { deepFreeze } from './host-api/deepFreeze';
export { eventBus } from './host-api/EventBus';

export {
	createRouteInjector,
	RouteInjector,
} from './inject/RouteInjector';
export {
	SidebarInjector,
	sidebarInjector,
} from './inject/SidebarInjector';

export {
	fetchEntryBuildId,
	loadRemoteApp,
	pluginBust,
	registerRemote,
	resolvePluginBust,
} from './mf/mf';
export {
	isVueRemoteModule,
	normalizePluginModule,
	type RawRemoteModule,
} from './mf/normalizePluginModule';

export {
	assertRegistryHostApiCompatible,
	clearRegistryCache,
	formatRegistryUpdatedAt,
	readRegistryCache,
	writeRegistryCache,
} from './registry/cache';

export {
	createPluginRuntime,
	PluginManager,
	type PluginRouteFactory,
	type PluginRuntime,
} from './runtime/createPluginRuntime';
export {
	configureVerifyEnv,
	entryUrlAllowed,
	PluginVerifyError,
	satisfiesRange,
	verifyPlugin,
} from './runtime/PluginVerifier';
export {
	__styleIsolationTest,
	attachPluginStyleIsolation,
	beginPluginStyleCapture,
	claimPluginPortalTarget,
	clearPluginPortalClaim,
	configureStyleIsolation,
	type StyleIsolationOptions,
	styleRealmKey,
} from './style-isolation';
export { DEFAULT_HOST_THEME_CUSTOM_PROP } from './style-isolation/css/themeStrip';
export type {
	HostBridgeProps,
	HostLocale,
	LoadedPlugin,
	PluginDescriptor,
	PluginLocaleMap,
	PluginModule,
	PluginPermission,
	PluginRegistry,
	PluginSidebarItem,
	PluginStatus,
	PluginTrust,
} from './types';
export { pickPluginLocaleText } from './types';
