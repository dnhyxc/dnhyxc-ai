import type React from 'react';
import type { PluginLocaleMap } from './localeText';

/**
 * Host 插件契约 semver；破坏性变更才升 major。
 * 优先读 `VITE_HOST_API_VERSION`，缺省 `1.0.0`。
 */
export const HOST_API_VERSION =
	import.meta.env.VITE_HOST_API_VERSION?.trim() || '1.0.0';

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
	/**
	 * 多语言插件名（插件中心 / 注入路由标题）。
	 * 新增或改名只改 registry，不必改 Host i18n。
	 */
	title?: PluginLocaleMap;
	/**
	 * 多语言说明，或旧版单语字符串。
	 */
	description?: string | PluginLocaleMap;
	routePath: string;
	entry: string;
	version: string;
	hostApiRange: string;
	menu?: { order: number; icon?: string };
	/**
	 * 是否由 PluginManager 注入顶层路由。
	 * false：宿主已在业务路由树（如英语学习子路由）挂好 PluginHostPage，只负责 loadRemote。
	 */
	injectRoute?: boolean;
	/**
	 * 业务页自动挂载声明。有此项后，对应 Host 页面按 surface/slot 渲染，不必硬编码 pluginId。
	 * - drawer：顶栏图标 + Drawer 内挂 PluginHostPage
	 * - toolbar：顶栏内联挂载 PluginHostPage（适合小块信息/操作）
	 */
	host?: {
		surface: 'ebook.read';
		slot: 'drawer' | 'toolbar';
		/** lucide 图标名，缺省 Puzzle（drawer 用） */
		icon?: string;
		order?: number;
	};
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
	/** version@manifestHash；与 MF entry bust 一致，用于判断是否需重载 */
	bust?: string;
}

export interface PluginSidebarItem {
	pluginId: string;
	path: string;
	nameKey: string;
	icon: string;
	order: number;
	requiresAuth?: boolean;
}
