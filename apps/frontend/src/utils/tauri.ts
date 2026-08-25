import type { WindowOptions } from '@/types';
import { MANAGED_HOST_WINDOW_LABELS } from '@/utils/hostWindowClose';
import { isTauriRuntime } from './runtime';

function readThemeFromLocalStorage(): 'dark' | 'light' | undefined {
	if (typeof localStorage === 'undefined') {
		return undefined;
	}
	const t = localStorage.getItem('theme');
	if (t === 'dark' || t === 'light') {
		return t;
	}
	return undefined;
}

/** Web 子窗引用：按 label 复用并 focus（避免 noopener 导致无法聚焦已有窗） */
const webChildWindows = new Map<string, Window>();

// 创建新窗口
export const onCreateWindow = async (options: WindowOptions) => {
	const {
		label = 'child-window',
		url,
		width,
		height,
		minWidth = width,
		minHeight = height,
		title = 'dnhyxc-ai',
		resizable = true,
		decorations = true,
		hiddenTitle = true,
		titleBarStyle = 'overlay',
		theme,
		x = (screen.width - width) / 2,
		y = (screen.height - height) / 2,
		createdCallback,
		errorCallback,
	} = options;

	if (!isTauriRuntime()) {
		const fullUrl =
			url.startsWith('http://') || url.startsWith('https://')
				? url
				: `${window.location.origin}${url.startsWith('/') ? url : `/${url}`}`;
		const existing = webChildWindows.get(label);
		if (existing && !existing.closed) {
			existing.focus();
			createdCallback?.();
			return;
		}
		const win = window.open(
			fullUrl,
			label,
			`width=${width},height=${height},left=${x},top=${y}`,
		);
		if (win) {
			webChildWindows.set(label, win);
			win.focus();
		}
		createdCallback?.();
		return;
	}

	const { invoke } = await import('@tauri-apps/api/core');
	const focused = await invoke<boolean>('focus_webview_window', { label });
	if (focused) {
		if (MANAGED_HOST_WINDOW_LABELS.has(label)) {
			void invoke('attach_managed_window_close', { label });
		}
		if (theme) {
			const win = await getWindowByLabel(label);
			try {
				await win?.setTheme(theme);
			} catch {
				// 主题失败不影响置顶
			}
		}
		createdCallback?.();
		return;
	}

	const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

	const webview = new WebviewWindow(label, {
		url,
		width,
		height,
		minWidth,
		minHeight,
		resizable,
		decorations,
		title,
		hiddenTitle,
		titleBarStyle,
		theme,
		x,
		y,
	});
	webview.once('tauri://created', () => {
		if (MANAGED_HOST_WINDOW_LABELS.has(label)) {
			void invoke('attach_managed_window_close', { label });
		}
		createdCallback?.();
	});
	webview.once('tauri://error', (e: unknown) => {
		errorCallback?.(e);
	});
};

// 根据 label 获取窗口
export const getWindowByLabel = async (label: string) => {
	if (!isTauriRuntime()) {
		return null;
	}
	const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
	return WebviewWindow.getByLabel(label);
};

// 更具 label 获取窗口设置对应主题
export const setTauriTheme = async (label: string, theme: 'dark' | 'light') => {
	if (!isTauriRuntime()) {
		return;
	}
	const _theme = theme || readThemeFromLocalStorage() || 'light';
	const win = await getWindowByLabel(label);
	win?.setTheme(_theme);
};

// 获取所有窗口
export const getAllWindows = async () => {
	if (!isTauriRuntime()) {
		return [];
	}
	const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
	return WebviewWindow.getAll();
};

export const setThemeToAllWindows = async (theme: 'dark' | 'light') => {
	if (!isTauriRuntime()) {
		return;
	}
	const _theme = theme || readThemeFromLocalStorage() || 'light';
	const allWindows = await getAllWindows();
	allWindows.forEach((win) => {
		win.setTheme(_theme);
	});
};
