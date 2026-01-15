import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { Toast } from '@ui/sonner';

export const checkForUpdates = async () => {
	const update = await check();
	if (update) {
		console.log(
			`found update ${update.version} from ${update.date} with notes ${update.body}`,
		);
		let downloaded = 0;
		let contentLength = 0;
		// alternatively we could also call update.download() and update.install() separately
		await update.downloadAndInstall((event) => {
			switch (event.event) {
				case 'Started':
					contentLength = event.data.contentLength || 0;
					console.log(`started downloading ${event.data.contentLength} bytes`);
					Toast({
						title: '正在下载更新...',
						type: 'loading',
					});
					break;
				case 'Progress':
					downloaded += event.data.chunkLength;
					Toast({
						title: `downloaded ${downloaded} from ${contentLength}`,
						type: 'loading',
					});
					console.log(`downloaded ${downloaded} from ${contentLength}`);
					break;
				case 'Finished':
					console.log('download finished');
					Toast({
						title: '下载完成',
						type: 'success',
					});
					break;
			}
		});

		console.log('update installed');
		Toast({
			title: '正在安装',
			type: 'success',
		});
		// 此处 relaunch 前最好询问用户
		await relaunch();
	}
};
