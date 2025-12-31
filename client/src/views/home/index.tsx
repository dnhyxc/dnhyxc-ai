import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Toast } from '@ui/sonner';
import { useCallback, useEffect, useState } from 'react';
import {
	downloadFile as download,
	downloadZip,
	getUserProfile,
} from '@/service';
import type { DownloadProgress } from '@/types';
// import type { DownloadFileInfo, DownloadProgress } from '@/types';
import { onCreateWindow, onEmit, onListen } from '@/utils';

const Home = () => {
	const [greetMsg, setGreetMsg] = useState('');
	// const [downloadFileInfo, setDownloadFileInfo] = useState<DownloadFileInfo[]>(
	// 	[],
	// );
	const [downloadProgressInfo, setDownloadProgressInfo] = useState<
		DownloadProgress[]
	>([]);
	const [url, setUrl] = useState(
		'https://dnhyxc.cn:9216/files/__FILE__88872d9ec263023cc77d8df9595e69c2.pdf',
		// 'https://dnhyxc.cn:9216/files/__FILE__86960f6b9b59b7d5cd9a1dfe9a6f88a0.docx',
	);

	// 在组件中添加进度监听
	useEffect(() => {
		const unlistenPromise = listen('download://progress', (event) => {
			const progress = event.payload as DownloadProgress;

			const info = {
				...progress,
				percent: progress.percent,
				filename: progress.file_name || '',
				id: progress.id,
				success: progress.success,
			};

			setDownloadProgressInfo((prev) => {
				const idx = prev.findIndex((item) => item.id === info.id);
				const payload = {
					url: progress.url,
					total_bytes: progress.total_bytes,
					content_length: progress.content_length,
					percent: progress.percent,
					file_path: progress.file_path,
					file_name: progress.file_name,
					file_size: progress.file_size,
					id: progress.id,
					success: progress.success,
					message: progress.message,
				};
				if (idx === -1) {
					return [payload, ...prev];
				}
				const next = [...prev];
				next[idx] = { ...next[idx], ...payload };
				return next;
			});
		});

		// const unlistenFileInfoPromise = listen('download://file_info', (event) => {
		// 	const info = event.payload as {
		// 		file_path: string;
		// 		file_name: string;
		// 		id: string;
		// 		content_type: string;
		// 		success: string;
		// 		message: string;
		// 	};
		// 	setDownloadFileInfo((prev) => [info, ...prev]);
		// });

		const unlistenAboutPromise = onListen('about-send-message', (event) => {
			console.log('about-send-message', event);
		});

		return () => {
			unlistenPromise.then((unlisten) => unlisten());
			// unlistenFileInfoPromise.then((unlisten) => unlisten());
			unlistenAboutPromise.then((unlisten) => unlisten());
		};
	}, []);

	async function greet() {
		const res: string = await invoke('greet_name', { name: url });
		console.log(res, 'greet_namegreet_namegreet_name');
		// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
		setGreetMsg(res);
	}

	async function saveFile() {
		const result = (await invoke('save_file_with_picker', {
			options: {
				content: '这是一个测试文件',
				file_name: 'document.txt',
			},
		})) as { success: boolean };

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
	}

	// 下载文件
	const downloadFile = useCallback(async (url?: string, filename?: string) => {
		if (url?.trim() === '') {
			return Toast({
				title: '请先传入文件路径',
				type: 'info',
			});
		}

		try {
			// 下载文件
			const result: any = await invoke('download_file', {
				options: {
					url: url,
					file_name: filename || undefined, // 如果用户输入了文件名则使用，否则自动获取
					// save_dir: './downloads',
					overwrite: true, // 覆盖已存在的文件
					id: Date.now().toString(),
				},
			});
			// setDownloadFileInfo((prev) => {
			// 	const idx = prev.findIndex((item) => item.id === result.id);
			// 	console.log(idx, 'idx');
			// 	if (idx === -1) {
			// 		return [result, ...prev];
			// 	}
			// 	const next = [...prev];
			// 	next[idx] = { ...next[idx], ...result };
			// 	return next;
			// });
			if (result.success) {
				console.log('文件保存成功:', result.file_path);
				Toast({
					title: result.message,
					type: result.success,
				});
			} else {
				console.error(`下载失败: ${result.message}`);
				Toast({
					title: result.message,
					type: result.success,
				});
			}
		} catch (_error) {
			Toast({
				title: '文件下载失败',
				type: 'error',
			});
		}
	}, []);

	// downloadFile(
	// 	'https://dnhyxc.cn:9216/files/__FILE__c7ee5b931b68b9e227fd94957587796d.epub',
	// )
	// downloadFile(
	// 	'https://dnhyxc.cn:9216/files/__FILE__86960f6b9b59b7d5cd9a1dfe9a6f88a0.docx',
	// )
	// downloadFile(
	// 	'https://dnhyxc.cn:9216/files/__FILE__88872d9ec263023cc77d8df9595e69c2.pdf',
	// )
	// downloadFile(
	// 	'https://files.codelife.cc/wallhaven/full/wq/wallhaven-wqkw2r.jpg?x-oss-process=image/resize,limit_0,m_fill,w_2560,h_1440/quality,Q_93/format,webp',
	// )

	const sendMessage = async () => {
		await onEmit('message', {
			message: 'hello world',
		});
	};

	const getUserInfo = async () => {
		const res = await getUserProfile(2);
		console.log(res.data, 'res-getUserInfo');
		Toast({
			title: '获取用户信息成功!',
			type: 'success',
			message: res.data.username,
		});
	};

	const onDownload = async () => {
		const res = await download(
			'0a6fad81-82d3-4598-8a55-f6dc326b1f61_128x128.png',
		);
		console.log(res, 'res-download', res.data);
		// downloadFile(`${res.data}`);
		downloadFile(`${import.meta.env.VITE_DEV_DOMAIN}${res.data}`);
	};

	const onDownloadZip = async () => {
		const res = await downloadZip(
			'0a6fad81-82d3-4598-8a55-f6dc326b1f61_128x128.png',
		);
		console.log(res, 'res-downloadZip', res.data);
		try {
			const result: any = await invoke('download_blob', {
				options: {
					file_name: 'test.zip', // 如果用户输入了文件名则使用，否则自动获取
					save_dir: '/Users/dnhyxc/Desktop',
					overwrite: false, // 是否覆盖已存在的文件
					id: Date.now().toString(),
				},
				blobData: res.data,
			});
			if (result) {
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
		} catch (_error) {
			Toast({
				type: 'error',
				title: '文件下载失败',
			});
		}
	};

	return (
		// data-tauri-drag-region: tauri 允许拖拽
		<div className="w-full h-full flex flex-col justify-center items-center m-0">
			<h1 className="text-3xl font-bold mb-20 text-green-600">
				Welcome to dnhyxc-ai
			</h1>
			<div>
				{downloadProgressInfo.map((i) => (
					<div key={i.id}>
						文件名称: {i.file_name}
						下载进度: {i.percent}% 下载状态:{' '}
						{i.success === 'success'
							? '完成'
							: i.success === 'start'
								? '进行中'
								: '失败'}
					</div>
				))}
			</div>
			{downloadProgressInfo.length > 0 && (
				<div className="mb-8 w-full max-w-2xl">
					<h3 className="text-lg font-bold mb-2">下载历史</h3>
					<div className="space-y-2 max-h-60 overflow-y-auto">
						{downloadProgressInfo.map((result, index) => (
							<div
								key={index}
								className={`p-3 rounded border ${
									result.success
										? 'bg-green-50 border-green-200'
										: 'bg-red-50 border-red-200'
								}`}
							>
								<div className="flex justify-between items-center">
									<span className="font-medium">
										{result.success === 'success'
											? '✅ 成功'
											: result.success === 'start'
												? '✨ 下载中'
												: '❌ 失败'}
									</span>
									<span className="text-sm text-gray-500">
										{result.file_size
											? `${(result.file_size / 1024).toFixed(1)} KB`
											: '未知大小'}
									</span>
								</div>
								{result.file_name && (
									<p className="text-sm truncate">文件名: {result.file_name}</p>
								)}
								<p className="text-sm">{result.message}</p>
							</div>
						))}
					</div>
				</div>
			)}
			<form
				className=""
				onSubmit={(e) => {
					e.preventDefault();
					greet();
				}}
			>
				<div className="flex gap-2 w-150">
					<Input
						id="greet-input"
						value={url}
						onChange={(e) => setUrl(e.currentTarget.value)}
						placeholder="Enter a name..."
					/>
					<Button className="cursor-pointer">Greet</Button>
				</div>
			</form>
			<p className="my-10 text-lg font-medium text-foreground">{greetMsg}</p>
			<Button
				variant="default"
				className="cursor-pointer"
				onClick={() =>
					onCreateWindow({
						url: '/win',
						width: 1000,
						height: 690,
					})
				}
			>
				Open Child Window
			</Button>
			<div className="flex justify-center items-center gap-4 mt-10">
				<Button className="cursor-pointer" onClick={sendMessage}>
					Send Message
				</Button>
				<Button className="cursor-pointer" onClick={getUserInfo}>
					获取用户信息
				</Button>
			</div>
			<div className="flex justify-center items-center gap-4 mt-10">
				<Button variant="default" className="cursor-pointer" onClick={saveFile}>
					Save File
				</Button>
				<Button
					variant="default"
					className="cursor-pointer"
					onClick={() => downloadFile(url)}
				>
					download File
				</Button>
				<Button
					variant="default"
					className="cursor-pointer"
					onClick={() => downloadFile(url)}
				>
					download pdf File
				</Button>
				<Button
					variant="default"
					className="cursor-pointer"
					onClick={onDownload}
				>
					download file from network
				</Button>
				<Button
					variant="default"
					className="cursor-pointer"
					onClick={onDownloadZip}
				>
					download zip file from network
				</Button>
			</div>
		</div>
	);
};

export default Home;
