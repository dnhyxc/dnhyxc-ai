import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { WindowOptions } from '@/types';

// 创建新窗口
export const onCreateWindow = async (options: WindowOptions) => {
	const {
		label,
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
		// 计算屏幕中心坐标
		x = (screen.width - width) / 2,
		y = (screen.height - height) / 2,
		createdCallback,
		errorCallback,
	} = options;

	// 获取窗口
	const getLabel = await WebviewWindow.getByLabel(label);

	// 如果窗口已存在，则聚焦窗口
	if (getLabel) {
		getLabel.setFocus();
	}

	// 创建窗口
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
		theme, // 不设置将是跟随系统
		x,
		y,
	});
	// since the webview window is created asynchronously,
	// Tauri emits the `tauri://created` and `tauri://error` to notify you of the creation response
	webview.once('tauri://created', () => {
		// webview window successfully created
		createdCallback?.();
	});
	webview.once('tauri://error', (e: any) => {
		// an error occurred during webview window creation
		errorCallback?.(e);
	});
};
