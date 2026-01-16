import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { Toast } from '@ui/sonner';

interface CheckForUpdatesOptions {
	getProgress?: (progress: number) => void;
	getTotal?: (total: number) => void;
	onRelaunch?: (relaunch: () => Promise<void>) => void;
}

export const checkVersion = async () => {
	const update = await check();
	return !!update;
};

export const checkForUpdates = async (options?: CheckForUpdatesOptions) => {
	const update = await check();
	if (update) {
		// let downloaded = 0;
		// let contentLength = 0;
		// alternatively we could also call update.download() and update.install() separately
		await update.downloadAndInstall((event) => {
			switch (event.event) {
				case 'Started':
					options?.getTotal?.(event.data.contentLength || 0);
					// contentLength = event.data.contentLength || 0;
					// console.log(`started downloading ${event.data.contentLength} bytes`);
					Toast({
						title: '正在下载更新...',
						type: 'loading',
					});
					break;
				case 'Progress':
					options?.getProgress?.(event.data.chunkLength);
					// downloaded += event.data.chunkLength;
					// Toast({
					// 	title: `downloaded ${downloaded} from ${contentLength}`,
					// 	type: 'loading',
					// });
					// console.log(`downloaded ${downloaded} from ${contentLength}`);
					break;
				case 'Finished':
					Toast({
						title: '更新完成',
						type: 'success',
					});
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
