import type { WindowOptions } from '@/types';
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
		window.open(
			fullUrl,
			label,
			`width=${width},height=${height},left=${x},top=${y},noopener,noreferrer`,
		);
		createdCallback?.();
		return;
	}

	const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');

	const getLabel = await WebviewWindow.getByLabel(label);

	if (getLabel) {
		getLabel.setFocus();
	}

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
