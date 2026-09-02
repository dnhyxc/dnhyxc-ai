import type React from 'react';
import type { HostLocale, PluginLocaleMap } from './localeText';

export type { HostLocale, PluginLocaleMap } from './localeText';
export { pickPluginLocaleText } from './localeText';

export type PluginTrust = 'first-party' | 'partner' | 'untrusted';

/** 开放字符串；常见值：ui:toast / nav:subtree / http:plugin-api / modules:* */
export type PluginPermission = string;

export interface PluginDescriptor {
	id: string;
	title?: PluginLocaleMap;
	description?: string | PluginLocaleMap;
	routePath: string;
	entry: string;
	version: string;
	hostApiRange: string;
	menu?: { order: number; icon?: string };
	/** 缺省 true：注入顶层路由；false 由业务页挂 PluginHostPage。true 且无 menu = 仅路由无侧栏 */
	injectRoute?: boolean;
	host?: {
		/** 宿主业务面，如 `ebook.read`；kit 不硬编码 */
		surface: string;
		slot: 'drawer' | 'toolbar' | (string & {});
		icon?: string;
		order?: number;
	};
	remoteName?: string;
	expose?: string;
	framework?: 'react' | 'vue';
	permissions: PluginPermission[];
	preload?: 'eager' | 'route' | 'idle';
	enabled: boolean;
	integrity?: string;
	signature?: string;
	trust: PluginTrust;
	iframeUrl?: string;
}

export interface PluginRegistry {
	updatedAt: string;
	plugins: PluginDescriptor[];
}

export interface HostBridgeProps {
	api: Readonly<{
		theme: 'light' | 'dark';
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
			setAppFullscreen?: (full: boolean) => Promise<void>;
			downloadBlob?: (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) => Promise<{
				ok: boolean;
				hostToasted: boolean;
				message?: string;
			}>;
			/**
			 * 选本地文件；取消 null。需 `ui:toast`。
			 * @see PickLocalFilesOptions / HostPickedLocalFile（config/types）
			 */
			pickLocalFiles?: (options?: {
				accept?: string;
				multiple?: boolean;
				title?: string;
			}) => Promise<
				| {
						path: string;
						name: string;
						src: string;
				  }[]
				| null
			>;
		};
		modules?: Readonly<Record<string, unknown>>;
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
