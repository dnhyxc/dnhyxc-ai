import { Toast } from '@ui/sonner';
import { getActiveLocale, type Locale } from '@/i18n';
import { downloadBlob, isTauriRuntime } from '@/utils';
import { http } from '@/utils/fetch';
import { setAppFullscreen } from '../host-api/appFullscreen';
import { deepFreeze } from '../host-api/deepFreeze';
import { eventBus } from '../host-api/EventBus';
import { createEbookModulesApi } from '../host-api/ebookHostApi';
import type { HostBridgeProps, PluginDescriptor } from './types';

const DOCX_MIME =
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function readTheme(): 'light' | 'dark' {
	try {
		const t = document.documentElement.getAttribute('data-theme');
		if (t === 'dark' || t === 'light') return t;
		if (document.documentElement.classList.contains('dark')) return 'dark';
		// Host 黑色主题挂在 body.theme-black（不是 html.dark）
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

function readLocale(): Locale {
	const locale = getActiveLocale();
	return locale === 'en-US' ? 'en-US' : 'zh-CN';
}

/** 按 permissions 组装并密封；未授权能力不存在 */
export function createHostBridge(
	d: PluginDescriptor,
	navigate: (to: string) => void,
): HostBridgeProps {
	const allow = new Set(d.permissions);
	const api: Record<string, unknown> = {
		theme: readTheme(),
		locale: readLocale(),
		event: {
			on: (event: string, handler: (data?: unknown) => void) =>
				eventBus.on(d.id, event, handler),
			off: (event: string, handler: (data?: unknown) => void) =>
				eventBus.off(d.id, event, handler),
			emit: (event: string, data?: unknown) => eventBus.emit(d.id, event, data),
		},
	};

	if (allow.has('ui:toast')) {
		api.ui = Object.freeze({
			showToast: (options: {
				message: string;
				type?: 'success' | 'error' | 'info';
			}) => {
				Toast({
					type: options.type ?? 'info',
					title: options.message,
				});
			},
			/** 应用级全屏：藏壳 + Tauri 窗口 / Web document 全屏 */
			setAppFullscreen,
			/** 与主站收藏导出同源：Web / Tauri2 统一落盘 */
			downloadBlob: async (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) => {
				const mime = options.mimeType?.trim() || DOCX_MIME;
				const raw = options.data;
				const bytes =
					raw instanceof ArrayBuffer
						? new Uint8Array(raw)
						: new Uint8Array(raw);
				const blob = new Blob([bytes], { type: mime });
				const result = await downloadBlob(
					{
						file_name: options.fileName || 'download',
						id: `plugin-${d.id}-${Date.now()}`,
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
		});
	}

	if (allow.has('nav:subtree')) {
		api.navigate = (to: string) => {
			if (!to.startsWith(d.routePath)) {
				throw new Error(`NAV_OUT_OF_SCOPE: ${to}`);
			}
			navigate(to);
		};
	}

	if (allow.has('http:plugin-api')) {
		api.http = Object.freeze({
			get: <T = unknown>(url: string) => http.get<T>(url),
			post: <T = unknown>(url: string, body?: unknown) =>
				http.post<T>(url, body),
			put: <T = unknown>(url: string, body?: unknown) => http.put<T>(url, body),
			delete: <T = unknown>(url: string) => http.delete<T>(url),
		});
	}

	const modules: Record<string, unknown> = {};
	if (allow.has('modules:chat')) {
		modules.openThread = (id: unknown) => {
			if (typeof id !== 'string') throw new Error('INVALID_THREAD_ID');
			navigate(`/chat/c/${id}`);
		};
	}
	if (allow.has('modules:ebook')) {
		modules.ebook = createEbookModulesApi();
	}
	if (Object.keys(modules).length > 0) {
		api.modules = Object.freeze(modules);
	}

	return deepFreeze({
		api,
		plugin: {
			id: d.id,
			version: d.version,
			routePath: d.routePath,
		},
	}) as HostBridgeProps;
}
