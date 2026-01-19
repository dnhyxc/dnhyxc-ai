import { invoke } from '@tauri-apps/api/core';

export const getCacheSize = async (): Promise<string> => {
	try {
		const size = await invoke<number>('get_cache_size');
		return formatBytes(size);
	} catch {
		return '0 B';
	}
};

export const clearCache = async (): Promise<void> => {
	await invoke('clear_updater_cache');
};

const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};
