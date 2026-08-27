/**
 * 本仓微前端 Host 适配：业务侧只从这里导入。
 * 勿在业务代码直接写 `@dnhyxc-ai/federation-kit`（本文件再导出常用符号）。
 *
 * 目录：
 * - runtime/       createFederation 门面（mf / pluginManager）
 * - registry/      COS registry 拉取与落盘
 * - enabled/       账号上架偏好
 * - host/          统一挂载模版（Page / Surface / Shell）
 * - capabilities/  注入 bridge 的通用 UI 能力
 * - sync/          跨窗 sync 基础设施
 * - modules/       各插件 api.modules.* 实现
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
	installAppFullscreenExitSync,
	setAppFullscreen,
	subscribeAppFullscreen,
	TAURI_WILL_EXIT_FULLSCREEN_EVENT,
	TAURI_WINDOW_FULLSCREEN_EVENT,
} from './capabilities/appFullscreen';
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
	type HostSvgParts,
	isPluginIconUrl,
	isThemeablePaint,
	normalizeSvgForHostIcon,
	type PluginIconKind,
	type PluginIconTheme,
} from './host/pluginIconUrl';
export {
	createEbookModulesApi,
	type EbookHostHandlers,
	type EbookHostThought,
	getEbookHostHandlers,
	setEbookHostHandlers,
} from './modules/ebook/hostApi';
export {
	createLearningNotesModulesApi,
	type LearningNotesHostModule,
	runLearningNotesBeforeCloseHandlers,
} from './modules/learningNotes/hostApi';
export {
	LEARNING_NOTES_SYNC_CHANNEL,
	type LearningNotesSyncMessage,
	type LearningNotesSyncMode,
	publishLearningNotesSync,
	subscribeLearningNotesSync,
} from './modules/learningNotes/syncBus';
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
export { createHostPluginSyncBus } from './sync/hostSyncBus';
