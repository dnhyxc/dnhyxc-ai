import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Toast } from '@ui/sonner';
import type {
	DownloadBlobOptions,
	DownloadOptions,
	DownloadProgress,
	DownloadResult,
} from '@/types';

export * from './event';
export * from './event';
export * from './tauri';

export const setStorage = (key: string, value: string) => {
	localStorage.setItem(key, value);
};

export const getStorage = (key: string) => {
	return localStorage.getItem(key);
};

export const removeStorage = (key: string) => {
	localStorage.removeItem(key);
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
	console.log(options, 'options');
	try {
		const result: any = await invoke('download_file', { options });
		return {
			success: result.success,
			message: result.message,
			id: result.id,
			file_path: result.file_path,
			file_name: result.file_name,
		};
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
		const result: any = await invoke('download_blob', { options, blobData });
		if (result.success) {
			Toast({
				type: result.success,
				title: result.message,
			});
		} else {
			Toast({
				type: result.success,
				title: result.message,
			});
		}
		return {
			success: result.success,
			message: result.message,
			id: result.id,
			file_path: result.file_path,
			file_name: result.file_name,
		};
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

/**
 * 处理网络下载并调用系统下载器
 */
export const donwnloadWithUrl = async (
	downloadUrl: string,
	fileName = '',
): Promise<DownloadResult> => {
	if (!downloadUrl?.trim()) {
		Toast?.({
			title: '请先传入文件路径',
			type: 'info',
		});
		return {
			success: 'error',
			message: '请先传入文件路径',
			id: Date.now().toString(),
		};
	}

	const result = await downloadFileFromUrl({
		url: downloadUrl,
		file_name: fileName || undefined,
		overwrite: true,
		id: Date.now().toString(),
		// max_size: 10000,
		// save_dir: './downloads',
	});

	console.log('result', result);

	Toast({
		title: result.message,
		type: result.success,
	});

	return result;
};
