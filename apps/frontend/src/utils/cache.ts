import { isTauriRuntime } from './runtime';

export const getCacheSize = async (): Promise<string> => {
	if (!isTauriRuntime()) {
		return '0 B';
	}
	try {
		const { invoke } = await import('@tauri-apps/api/core');
		const size = await invoke<number>('get_cache_size');
		return formatBytes(size);
	} catch {
		return '0 B';
	}
};

export const clearCache = async (): Promise<void> => {
	if (!isTauriRuntime()) {
		return;
	}
	const { invoke } = await import('@tauri-apps/api/core');
	await invoke('clear_updater_cache');
};

const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
};
