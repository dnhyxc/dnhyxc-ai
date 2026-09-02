import type { ReactNode } from 'react';
import type {
	HostBridgeProps,
	HostLocale,
	PluginDescriptor,
	PluginRegistry,
} from '../types';

export type HostTheme = 'light' | 'dark';

/** Host → untrusted iframe：主题与 CSS 变量快照 */
export type HostIframeAppearance = {
	theme: HostTheme;
	/** 计算后的 CSS 自定义属性（含 --background / --brand-accent 等） */
	cssVars: Record<string, string>;
	/**
	 * 是否给 iframe 加 `.dark`。须与 Host 一致：主站常用 `theme-black` 而无 `.dark`，
	 * 若 iframe 强行 `.dark`，会误触 `dark:border-input` 等，outline 按钮边框会「消失」。
	 */
	darkClass?: boolean;
};

/** 插件选本地文件选项（与宿主 select-files 对齐） */
export type PickLocalFilesOptions = {
	/** 如 `.mp4,.webm`；不传则不限制 */
	accept?: string;
	/** 默认 false（单选，仍返回 length≤1 的数组） */
	multiple?: boolean;
	/** 系统对话框标题（部分平台可能忽略） */
	title?: string;
};

/** 选中项：path 为桌面绝对路径（Web 可能仅为文件名）；src 可直接作 media URL */
export type HostPickedLocalFile = {
	path: string;
	name: string;
	src: string;
};

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
	/**
	 * 系统选文件（桌面 Tauri 对话框 / Web 回退 input）。
	 * 取消返回 null；成功始终为数组（单选 1 项）。
	 * 权限门闩与 toast 相同：`ui:toast`。
	 */
	pickLocalFiles?: (
		options?: PickLocalFilesOptions,
	) => Promise<HostPickedLocalFile[] | null>;
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
	/**
	 * untrusted iframe：读取当前主题 + CSS 变量快照（随 init / appearance 下发）。
	 * 缺省则 iframe 只用 bridge.api.theme，不继承 Host token。
	 */
	getAppearance?: () => HostIframeAppearance;
	/** 主题 / 强调色等变化时推送；返回取消订阅 */
	onAppearanceChange?: (
		handler: (appearance: HostIframeAppearance) => void,
	) => () => void;
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
