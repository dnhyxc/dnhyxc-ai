import { Toast } from '@ui/sonner';
import { isTauriRuntime } from './runtime';

interface CheckForUpdatesOptions {
	getProgress?: (progress: number) => void;
	getTotal?: (total: number) => void;
	onRelaunch?: (relaunch: () => Promise<void>) => void;
	setLoading?: (loading: boolean) => void;
	onReset?: () => void;
	onFinished?: () => void;
}

export type UpdateType = import('@tauri-apps/plugin-updater').Update;

export const checkVersion = async () => {
	if (!isTauriRuntime()) {
		return null;
	}
	const { check } = await import('@tauri-apps/plugin-updater');
	return check();
};

export const checkForUpdates = async (options?: CheckForUpdatesOptions) => {
	if (!isTauriRuntime()) {
		Toast({
			type: 'info',
			title: '应用内更新仅在桌面客户端可用',
		});
		options?.onReset?.();
		return;
	}
	try {
		const [{ check }, { relaunch }] = await Promise.all([
			import('@tauri-apps/plugin-updater'),
			import('@tauri-apps/plugin-process'),
		]);
		const update = await check();
		if (update) {
			options?.setLoading?.(true);
			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case 'Started':
						options?.getTotal?.(event.data.contentLength || 0);
						break;
					case 'Progress':
						options?.getProgress?.(event.data.chunkLength);
						break;
					case 'Finished':
						options?.onFinished?.();
						break;
				}
			});
			options?.onRelaunch?.(relaunch);
		}
	} catch (error: unknown) {
		const msg =
			error && typeof error === 'object' && 'message' in error
				? String((error as { message: unknown }).message)
				: String(error);
		Toast({
			type: 'error',
			title: '更新失败',
			message: msg,
		});
		options?.onReset?.();
	}
};
