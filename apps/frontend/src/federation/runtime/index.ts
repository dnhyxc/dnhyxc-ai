/**
 * 本仓微前端门面：基于 createFederation（主流 start + <Plugin />）。
 * 产品差异（Toast / COS / ebook / 偏好）集中在此文件。
 */
import {
	createFederation,
	DEFAULT_HOST_THEME_CUSTOM_PROP,
	type HostHttpClient,
	type PluginDescriptor,
} from '@dnhyxc-ai/federation-kit';
import { Toast } from '@ui/sonner';
import { type ComponentType, createElement } from 'react';
import { getActiveLocale, type Locale, translateSync } from '@/i18n';
import type { RouteConfig } from '@/router/routes';
import { downloadBlob, isTauriRuntime, onListen } from '@/utils';
import { http } from '@/utils/fetch';
import { setAppFullscreen } from '../capabilities/appFullscreen';
import { pickLocalFilesForPlugins } from '../capabilities/pickLocalFiles';
import {
	arePluginEnabledPrefsReady,
	ensurePluginEnabledPrefsLoaded,
	getPluginEnabledPref,
	setPluginEnabledPref,
} from '../enabled/prefs';
import { createEbookModulesApi } from '../modules/ebook/hostApi';
import { createLearningNotesModulesApi } from '../modules/learningNotes/hostApi';
import {
	fetchPluginRegistry,
	PLUGIN_REGISTRY_CACHE_KEY,
	persistPluginEnabled,
} from '../registry';

const DOCX_MIME =
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const hostHttp: HostHttpClient = {
	get: ((url: string) => http.get(url)) as HostHttpClient['get'],
	post: ((url: string, body?: unknown) =>
		http.post(url, body)) as HostHttpClient['post'],
	put: ((url: string, body?: unknown) =>
		http.put(url, body)) as HostHttpClient['put'],
	delete: ((url: string) => http.delete(url)) as HostHttpClient['delete'],
};

function readTheme(): 'light' | 'dark' {
	try {
		const t = document.documentElement.getAttribute('data-theme');
		if (t === 'dark' || t === 'light') return t;
		if (document.documentElement.classList.contains('dark')) return 'dark';
		if (
			document.body.classList.contains('dark') ||
			document.body.classList.contains('theme-black')
		) {
			return 'dark';
		}
	} catch {
		/* ignore */
	}
	return 'light';
}

function readLocale(): 'zh-CN' | 'en-US' {
	return getActiveLocale() === 'en-US' ? 'en-US' : 'zh-CN';
}

let hostPage: ComponentType<{ pluginId: string; pageShell?: boolean }> | null =
	null;

export function registerPluginHostPage(
	page: ComponentType<{ pluginId: string; pageShell?: boolean }>,
) {
	hostPage = page;
}

function createPluginRoute(meta: PluginDescriptor): RouteConfig {
	const Page: ComponentType = () => {
		if (!hostPage) throw new Error('PluginHostPage not registered');
		return createElement(hostPage, { pluginId: meta.id, pageShell: true });
	};
	return {
		path: meta.routePath,
		Component: Page,
		meta: { titleI18n: meta.title, title: meta.id },
	};
}

/** 全局 MF Host（asDefault，供 <Plugin /> / FederationPlugin 使用） */
export const mf = createFederation<RouteConfig>({
	hostApiVersion: import.meta.env.VITE_HOST_API_VERSION?.trim() || '1.0.0',
	prod: import.meta.env.PROD,
	skipIntegrity: import.meta.env.VITE_PLUGIN_SKIP_INTEGRITY !== 'false',
	storagePrefix: 'dnhyxc.plugin',
	registryCacheKey: PLUGIN_REGISTRY_CACHE_KEY,
	iframeChannel: 'dnhyxc-mf-iframe',
	fetchRegistry: fetchPluginRegistry,
	persistEnabled: persistPluginEnabled,
	enabledStore: {
		get: getPluginEnabledPref,
		set: setPluginEnabledPref,
		load: ensurePluginEnabledPrefsLoaded,
		isReady: arePluginEnabledPrefsReady,
	},
	styleIsolation: {
		themePropPattern: DEFAULT_HOST_THEME_CUSTOM_PROP,
		hostViteRootMarker: '/apps/frontend',
	},
	translate: (key, params) =>
		translateSync(key, params as Record<string, string>),
	createRoute: createPluginRoute,
	capabilities: {
		getTheme: readTheme,
		getLocale: readLocale,
		navigate: (to) => window.location.assign(to),
		toast: (options) => {
			Toast({
				type: options.type ?? 'info',
				title: options.message,
			});
		},
		http: hostHttp,
		setAppFullscreen,
		pickLocalFiles: pickLocalFilesForPlugins,
		downloadBlob: async (options) => {
			const mime = options.mimeType?.trim() || DOCX_MIME;
			const raw = options.data;
			const bytes =
				raw instanceof ArrayBuffer ? new Uint8Array(raw) : new Uint8Array(raw);
			const blob = new Blob([bytes], { type: mime });
			const result = await downloadBlob(
				{
					file_name: options.fileName || 'download',
					id: `plugin-${options.pluginId}-${Date.now()}`,
					overwrite: true,
				},
				blob,
			);
			const hostToasted = isTauriRuntime();
			if (result.success !== 'success') {
				return {
					ok: false as const,
					hostToasted,
					message: result.message || '下载失败',
				};
			}
			return { ok: true as const, hostToasted };
		},
		buildModules: (allow) => {
			const modules: Record<string, unknown> = {};
			if (allow.has('modules:learningNotes')) {
				modules.learningNotes = createLearningNotesModulesApi();
			}
			if (allow.has('modules:chat')) {
				modules.openThread = (id: unknown) => {
					if (typeof id !== 'string') throw new Error('INVALID_THREAD_ID');
					window.location.assign(`/chat/c/${id}`);
				};
			}
			if (allow.has('modules:ebook')) {
				modules.ebook = createEbookModulesApi();
			}
			return Object.keys(modules).length > 0 ? modules : undefined;
		},
		onLocaleChange: (handler) => {
			let unlisten: (() => void) | undefined;
			void onListen<Locale>('locale', (next) => {
				if (next === 'zh-CN' || next === 'en-US') handler(next);
			}).then((fn) => {
				unlisten = fn;
			});
			return () => unlisten?.();
		},
	},
	iframeRpcHandlers: {
		'ebook.getBookId': (bridge) => {
			const ebook = bridge.api.modules?.ebook as
				| { getBookId: () => string | null }
				| undefined;
			return ebook?.getBookId() ?? null;
		},
		'ebook.getBookTitle': (bridge) => {
			const ebook = bridge.api.modules?.ebook as
				| { getBookTitle: () => string | null }
				| undefined;
			return ebook?.getBookTitle() ?? null;
		},
		'ebook.navigateToCfi': async (bridge, args) => {
			const ebook = bridge.api.modules?.ebook as
				| { navigateToCfi: (cfi: string) => void | Promise<void> }
				| undefined;
			await ebook?.navigateToCfi(String(args[0] ?? ''));
			return null;
		},
		'ebook.openThought': (bridge, args) => {
			const ebook = bridge.api.modules?.ebook as
				| { openThought: (t: unknown) => void }
				| undefined;
			ebook?.openThought(args[0]);
			return null;
		},
		'ebook.closeIdeasList': (bridge) => {
			const ebook = bridge.api.modules?.ebook as
				| { closeIdeasList?: () => void }
				| undefined;
			ebook?.closeIdeasList?.();
			return null;
		},
	},
});

export const pluginManager = mf.manager;
export const routeInjector = mf.routeInjector;
export const sidebarInjector = mf.sidebarInjector;
export const HOST_API_VERSION = mf.runtime.hostApiVersion;
export const appRuntime = mf.runtime;

export const getAppIframeBridgeOptions = () => mf.getIframeBridgeOptions();

/** @deprecated 用 mf.start() */
export const startFederation = () => mf.start();
