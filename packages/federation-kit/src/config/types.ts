import type { ReactNode } from 'react';
import type {
	HostBridgeProps,
	HostLocale,
	PluginDescriptor,
	PluginRegistry,
} from '../types';

export type HostTheme = 'light' | 'dark';

export interface HostHttpClient {
	get: <T = unknown>(url: string) => Promise<T>;
	post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
	put: <T = unknown>(url: string, body?: unknown) => Promise<T>;
	delete: <T = unknown>(url: string) => Promise<T>;
}

export interface HostCapabilities {
	getTheme: () => HostTheme;
	getLocale: () => HostLocale;
	navigate: (to: string) => void;
	toast?: (options: {
		message: string;
		type?: 'success' | 'error' | 'info';
	}) => void;
	http?: HostHttpClient;
	downloadBlob?: (options: {
		fileName: string;
		data: ArrayBuffer | Uint8Array;
		mimeType?: string;
		pluginId: string;
	}) => Promise<{ ok: boolean; hostToasted: boolean; message?: string }>;
	setAppFullscreen?: (full: boolean) => Promise<void>;
	/** 业务模块挂载点（如 ebook）；按 permission `modules:xxx` 装配 */
	modules?: Record<string, unknown>;
	/**
	 * 自定义 modules 装配（如 `modules:chat` → `openThread`）。
	 * 若提供则优先于 `modules` 的简单键匹配。
	 */
	buildModules?: (
		permissions: ReadonlySet<string>,
	) => Record<string, unknown> | undefined;
	/** 监听 Host locale 变化；返回取消订阅 */
	onLocaleChange?: (handler: (locale: HostLocale) => void) => () => void;
}

export interface EnabledStore {
	get: (pluginId: string) => boolean;
	set?: (pluginId: string, enabled: boolean) => Promise<void> | void;
	subscribe?: (fn: () => void) => () => void;
	load?: () => Promise<void>;
	/** 异步偏好是否已就绪；缺省视为 true */
	isReady?: () => boolean;
}

export interface StyleIsolationConfig {
	/** 覆盖默认 Host 主题 CSS 变量剥离正则 */
	themePropPattern?: RegExp;
	/** Vite 开发态 Host 源码根标记，默认 `/apps/frontend` */
	hostViteRootMarker?: string;
}

export interface PluginRouteSpec {
	path: string;
	pluginId: string;
	title?: PluginDescriptor['title'];
}

export interface PluginHostConfig {
	hostApiVersion?: string;
	/** 生产环境（影响 entry http 准入）；缺省看 `process.env.NODE_ENV` */
	prod?: boolean;
	skipIntegrity?: boolean;
	storagePrefix?: string;
	/** registry localStorage key；缺省 `${storagePrefix}.registry.v1` */
	registryCacheKey?: string;
	fetchRegistry: (opts?: { force?: boolean }) => Promise<PluginRegistry>;
	/** 上架/下架后刷新；缺省用 fetchRegistry + enabledStore.set */
	persistEnabled?: (id: string, enabled: boolean) => Promise<PluginRegistry>;
	enabledStore: EnabledStore;
	capabilities: HostCapabilities;
	styleIsolation?: StyleIsolationConfig;
	/** iframe postMessage channel；默认 `mf-iframe` */
	iframeChannel?: string;
	/** 自定义路由壳元素；缺省由 Host 自行订阅 routeInjector */
	createRouteElement?: (pluginId: string) => ReactNode;
	/** 扩展 iframe RPC（在内置 http/ui 之后） */
	iframeRpcHandlers?: Record<
		string,
		(bridge: HostBridgeProps, args: unknown[]) => unknown | Promise<unknown>
	>;
	translate?: (key: string, params?: Record<string, string>) => string;
}
