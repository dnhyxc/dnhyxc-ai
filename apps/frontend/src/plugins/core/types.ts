import type React from 'react';

/** Host 插件契约 semver；破坏性变更才升 major */
export const HOST_API_VERSION = '1.0.0';

export type PluginTrust = 'first-party' | 'partner' | 'untrusted';

export type PluginPermission =
	| 'ui:toast'
	| 'nav:subtree'
	| 'http:plugin-api'
	| 'modules:chat'
	| 'modules:ebook'
	| (string & {});

export interface PluginDescriptor {
	id: string;
	titleKey?: string;
	/** 插件作用说明的 i18n key（插件中心卡片展示） */
	descriptionKey?: string;
	/** 明文说明（第三方无 Host i18n 时用；有 descriptionKey 时以 key 为准） */
	description?: string;
	routePath: string;
	entry: string;
	version: string;
	hostApiRange: string;
	menu?: { order: number; icon?: string; nameKey?: string };
	/**
	 * 是否由 PluginManager 注入顶层路由。
	 * false：宿主已在业务路由树（如英语学习子路由）挂好 PluginHostPage，只负责 loadRemote。
	 */
	injectRoute?: boolean;
	/** MF registerRemotes.name；默认 `id`。多插件共享同一 Remote 时填 federation name */
	remoteName?: string;
	/** MF expose 路径；默认 `./App`（如 `./IdeasList`） */
	expose?: string;
	permissions: PluginPermission[];
	/**
	 * 加载时机（默认 route = 懒加载）：
	 * - `route` / `idle` / 省略：仅首次进入插件页 / ensurePlugin 时 loadRemote
	 * - `eager`：init 后微任务后台预拉（不阻塞启动；一般勿用）
	 */
	preload?: 'eager' | 'route' | 'idle';
	enabled: boolean;
	integrity?: string;
	signature?: string;
	trust: PluginTrust;
	/**
	 * `trust: untrusted` 必填：独立 HTTPS 页，Host 用 iframe 打开，不 loadRemote。
	 * 生产须 https；开发可 localhost http。
	 */
	iframeUrl?: string;
}

export interface PluginRegistry {
	updatedAt: string;
	plugins: PluginDescriptor[];
}

export type HostLocale = 'zh-CN' | 'en-US';

export interface HostBridgeProps {
	api: Readonly<{
		theme: 'light' | 'dark';
		/**
		 * 与 Host 顶栏语言一致；插件自维护文案字典，仅跟随此 locale。
		 * 切换后由 PluginHostPage / iframe / eventBus 推送更新。
		 */
		locale: HostLocale;
		navigate?: (to: string) => void;
		event: {
			on: (event: string, handler: (data?: unknown) => void) => void;
			off: (event: string, handler: (data?: unknown) => void) => void;
			emit: (event: string, data?: unknown) => void;
		};
		http?: {
			get: <T = unknown>(url: string) => Promise<T>;
			post: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			put: <T = unknown>(url: string, body?: unknown) => Promise<T>;
			delete: <T = unknown>(url: string) => Promise<T>;
		};
		ui?: {
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => void;
			/**
			 * 统一落盘（Web `<a download>` / Tauri `download_blob`）。
			 * Tauri 成功/失败时 Host 已 Toast，`hostToasted: true` 时插件勿再弹成功提示。
			 */
			downloadBlob?: (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) => Promise<{
				ok: boolean;
				hostToasted: boolean;
				message?: string;
			}>;
		};
		modules?: Readonly<Record<string, (...args: unknown[]) => unknown>>;
	}>;
	plugin: Readonly<Pick<PluginDescriptor, 'id' | 'version' | 'routePath'>>;
}

export interface PluginModule {
	default: React.ComponentType<HostBridgeProps>;
	activate?: (api: HostBridgeProps['api']) => Promise<void> | void;
	deactivate?: () => Promise<void> | void;
}

export type PluginStatus =
	| 'registered'
	| 'loading'
	| 'activated'
	| 'failed'
	| 'unloaded';

export interface LoadedPlugin {
	meta: PluginDescriptor;
	bridge: HostBridgeProps;
	mod: PluginModule;
	status: PluginStatus;
	error?: string;
}

export interface PluginSidebarItem {
	pluginId: string;
	path: string;
	nameKey: string;
	icon: string;
	order: number;
	requiresAuth?: boolean;
}
