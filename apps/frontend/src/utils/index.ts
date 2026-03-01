import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { fetch } from '@tauri-apps/plugin-http';
import { Toast } from '@ui/sonner';
import type {
	DownloadBlobOptions,
	DownloadOptions,
	DownloadProgress,
	DownloadResult,
} from '@/types';

export * from './cache';
export * from './clipboard';
export * from './crypto';
export * from './event';
export * from './event';
export * from './store';
export * from './tauri';
export * from './updater';

export const setStorage = (key: string, value: string) => {
	localStorage.setItem(key, value);
	window.dispatchEvent(new Event(`${key}Changed`));
};

export const getStorage = (key: string) => {
	return localStorage.getItem(key);
};

export const removeStorage = (key: string) => {
	localStorage.removeItem(key);
	window.dispatchEvent(new Event(`${key}Changed`));
};

export const setBodyClass = (theme: string) => {
	if (theme === 'dark') {
		document.body.classList.add('dark');
	} else {
		document.body.classList.remove('dark');
	}
};

/**
 * 下载文件从URL
 */
export const downloadFileFromUrl = async (
	options: DownloadOptions,
): Promise<DownloadResult> => {
	const { url, file_name, overwrite = true, id, max_size, save_dir } = options;
	try {
		const result: DownloadResult = await invoke('download_file', {
			options: {
				url,
				file_name,
				overwrite,
				id,
				max_size,
				save_dir,
			},
		});
		return result;
	} catch (error) {
		return {
			success: 'error',
			message: error instanceof Error ? error.message : '下载文件失败',
			id: options.id,
		};
	}
};

/**
 * 下载Blob数据
 */
export const downloadBlob = async (
	options: DownloadBlobOptions,
	blobData: any,
): Promise<DownloadResult> => {
	try {
		const result: DownloadResult = await invoke('download_blob', {
			options,
			blobData,
		});
		if (result.success) {
			Toast({
				type: result.success as 'success' | 'error',
				title: result.message,
			});
		} else {
			Toast({
				type: result.success,
				title: result.message,
			});
		}
		return result;
	} catch (error) {
		return {
			success: 'error',
			message: error instanceof Error ? error.message : '下载Blob失败',
			id: options.id,
		};
	}
};

/**
 * 保存文件到本地
 */
export const saveFileWithPicker = async (options: {
	content: string;
	file_name: string;
}): Promise<{ success: boolean; message?: string }> => {
	try {
		const result = (await invoke('save_file_with_picker', { options })) as {
			success: boolean;
			message?: string;
		};
		if (result.success) {
			Toast({
				type: 'success',
				title: '文件保存成功',
			});
		} else {
			Toast({
				type: 'error',
				title: '文件保存失败',
			});
		}
		return result as { success: boolean; message?: string; file_path?: string };
	} catch (error) {
		Toast({
			type: 'error',
			title: '文件保存失败',
		});
		return {
			success: false,
			message: error instanceof Error ? error.message : '保存文件失败',
		};
	}
};

/**
 * 创建下载进度监听器
 */
export const createDownloadProgressListener = (
	setProgressInfo: React.Dispatch<React.SetStateAction<DownloadProgress[]>>,
): Promise<UnlistenFn> => {
	const unlistenPromise = listen('download://progress', (event) => {
		const progress = event.payload as DownloadProgress;
		setProgressInfo((prev) => {
			const idx = prev.findIndex((item) => item.id === progress.id);
			if (idx === -1) {
				return [progress, ...prev];
			}
			const next = [...prev];
			next[idx] = { ...next[idx], ...progress };
			return next;
		});
	});
	return unlistenPromise;
};

export const createUnlistenFileInfoListener = (
	setDownloadInfo?: React.Dispatch<React.SetStateAction<DownloadResult[]>>,
): Promise<UnlistenFn> => {
	const unlistenPromise = listen('download://progress', (event) => {
		const progress = event.payload as DownloadResult;
		setDownloadInfo?.((prev) => {
			const idx = prev.findIndex((item) => item.id === progress.id);
			if (idx === -1) {
				return [progress, ...prev];
			}
			const next = [...prev];
			next[idx] = { ...next[idx], ...progress };
			return next;
		});
	});
	return unlistenPromise;
};

/**
 * 处理网络下载并调用系统下载器
 */
export const donwnloadWithUrl = async (
	options: DownloadOptions,
	_setDownloadFileInfo?: React.Dispatch<React.SetStateAction<DownloadResult[]>>,
): Promise<DownloadResult> => {
	return downloadFileFromUrl(options);
};

/**
 * 处理图片下载
 */
export const handlerDownload = (url: string): void => {
	downloadFileFromUrl({ url });
};

// 设置首字母大写
export const capitalizeWords = (str: string) => {
	return str
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ');
};

// 格式化显示时间
export const formatTime = (seconds: number) => {
	const secs = Math.max(0, Math.ceil(seconds));
	return `${secs.toString()}s`;
};

// 格式化日期
export const formatDate = (date: string) => {
	const d = new Date(date);
	const pad = (n: number) => n.toString().padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * 通过 Tauri 的 HTTP 插件获取图片，并返回 Blob URL
 * 用于绕过浏览器的跨域资源策略限制
 */
export const fetchImageAsBlobUrl = async (url: string): Promise<string> => {
	try {
		const response = await fetch(url, {
			method: 'GET',
		});
		// response 是标准的 Response 对象
		const arrayBuffer = await response.arrayBuffer();
		const blob = new Blob([arrayBuffer]);
		const blobUrl = URL.createObjectURL(blob);
		return blobUrl;
	} catch (_) {
		// 如果失败，返回原始 URL
		return url;
	}
};

/**
 * 清理 Blob URL 以防止内存泄漏
 */
export const revokeBlobUrl = (blobUrl: string): void => {
	if (blobUrl.startsWith('blob:')) {
		URL.revokeObjectURL(blobUrl);
	}
};

/**
 * 验证 URL 是否是合法的图片地址
 */
export const isValidImageUrl = (url: string): boolean => {
	try {
		const parsed = new URL(url);
		// 只允许 http 和 https 协议
		if (!['http:', 'https:'].includes(parsed.protocol)) {
			return false;
		}
		// 检查常见图片扩展名
		const pathname = parsed.pathname.toLowerCase();
		const imageExtensions = [
			'.jpg',
			'.jpeg',
			'.png',
			'.gif',
			'.webp',
			'.svg',
			'.bmp',
			'.tiff',
			'.ico',
		];
		const hasImageExtension = imageExtensions.some((ext) =>
			pathname.endsWith(ext),
		);
		// 如果 URL 有扩展名但不是图片扩展名，则拒绝
		if (pathname.includes('.') && !hasImageExtension) {
			return false;
		}
		// 其他情况允许通过（无扩展名或有效图片扩展名）
		return true;
	} catch {
		return false;
	}
};
