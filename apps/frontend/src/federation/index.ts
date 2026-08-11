/**
 * 本仓微前端 Host 适配：业务侧只从这里导入。
 * 勿在业务代码直接写 `@dnhyxc-ai/federation-kit`（本文件再导出常用符号）。
 *
 * 目录：
 * - runtime/       createFederation 门面（mf / pluginManager）
 * - registry/      COS registry 拉取与落盘
 * - enabled/       账号上架偏好
 * - host/          统一挂载模版（Page / Surface / Shell）
 * - capabilities/  产品能力（全屏、ebook API）
 */

export {
	claimPluginPortalTarget,
	clearPluginPortalClaim,
	type HostHttpClient,
	isEnabledPrefsReady,
	isPluginEnabled,
	listHostSurfacePlugins,
	notifyPluginEnabled,
	type PluginDescriptor,
	type PluginRegistry,
	pickPluginLocaleText,
	styleRealmKey,
	subscribePluginEnabled,
} from '@dnhyxc-ai/federation-kit';
export {
	FederationPlugin,
	type FederationPluginProps,
	type PluginEnabledState,
	type PluginHostViewSlots,
	type PluginHostViewVariant,
	useHostSurfacePlugins,
	usePluginEnabled,
	usePluginEnabledState,
} from '@dnhyxc-ai/federation-kit/react';

export {
	APP_FULLSCREEN_EVENT,
	getAppFullscreen,
	setAppFullscreen,
	subscribeAppFullscreen,
} from './capabilities/appFullscreen';
export {
	createEbookModulesApi,
	type EbookHostHandlers,
	type EbookHostThought,
	getEbookHostHandlers,
	setEbookHostHandlers,
} from './capabilities/ebookHostApi';
export {
	arePluginEnabledPrefsReady,
	clearPluginEnabledPrefsCache,
	ensurePluginEnabledPrefsLoaded,
	getPluginEnabledPref,
	prefetchPluginEnabledPrefs,
	setPluginEnabledPref,
} from './enabled/prefs';
export { PluginErrorBoundary } from './host/PluginErrorBoundary';
export { PluginHostPage } from './host/PluginHostPage';
export {
	PluginHostSurface,
	type PluginHostSurfacePart,
	type PluginHostSurfaceProps,
} from './host/PluginHostSurface';
export { PluginIcon, type PluginIconProps } from './host/PluginIcon';
export { PluginPageShell } from './host/PluginPageShell';
export {
	applyPluginIconUrl,
	isPluginIconUrl,
} from './host/pluginIconUrl';
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
} from './registry';
export {
	appRuntime,
	getAppIframeBridgeOptions,
	HOST_API_VERSION,
	mf,
	pluginManager,
	routeInjector,
	sidebarInjector,
	startFederation,
} from './runtime';
