import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { Toast } from '@/components/ui/sonner';

interface CheckForUpdatesOptions {
	getProgress?: (progress: number) => void;
	getTotal?: (total: number) => void;
	onRelaunch?: (relaunch: () => Promise<void>) => void;
	setLoading?: (loading: boolean) => void;
}

export type UpdateType = Update;

export const checkVersion = async () => {
	try {
		const update = await check();
		return update;
	} catch (error: any) {
		Toast({
			type: 'error',
			title: '检查更新失败',
			message: error?.message || String(error),
		});
	}
};

export const checkForUpdates = async (options?: CheckForUpdatesOptions) => {
	const update = await check();
	if (update) {
		await update.downloadAndInstall((event) => {
			switch (event.event) {
				case 'Started':
					options?.setLoading?.(true);
					options?.getTotal?.(event.data.contentLength || 0);
					break;
				case 'Progress':
					options?.getProgress?.(event.data.chunkLength);
					break;
				case 'Finished':
					break;
			}
		});

		options?.onRelaunch?.(relaunch);

		// console.log('update installed');
		// Toast({
		// 	title: '正在安装',
		// 	type: 'success',
		// });
		// await new Promise((resolve) => setTimeout(resolve, 1000));
		// // 此处 relaunch 前最好询问用户
		// await relaunch();
	}
};
