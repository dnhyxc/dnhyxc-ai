import { invoke } from '@tauri-apps/api/core';
import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { Toast } from '@ui/sonner';
import { useEffect, useState } from 'react';
import {
	downloadFile as download,
	downloadZip,
	getUserProfile,
} from '@/service';
import type { DownloadProgress, DownloadResult } from '@/types';
import {
	createDownloadProgressListener,
	createUnlistenFileInfoListener,
	donwnloadWithUrl,
	downloadBlob,
	getStorage,
	onCreateWindow,
	onEmit,
	onListen,
	saveFileWithPicker,
} from '@/utils';

const Home = () => {
	const [greetMsg, setGreetMsg] = useState('');
	const [downloadFileInfo, setDownloadFileInfo] = useState<DownloadResult[]>(
		[],
	);
	const [downloadProgressInfo, setDownloadProgressInfo] = useState<
		DownloadProgress[]
	>([]);
	const [url, setUrl] = useState(
		'https://dnhyxc.cn:9216/files/__FILE__88872d9ec263023cc77d8df9595e69c2.pdf',
	);

	// 在组件中添加进度监听
	useEffect(() => {
		console.log(JSON.parse(getStorage('userInfo') || '{}'));
		const unlistenProgress = createDownloadProgressListener(
			setDownloadProgressInfo,
		);

		const unlistenDownloadInfo =
			createUnlistenFileInfoListener(setDownloadFileInfo);

		const unlistenAboutPromise = onListen('about-send-message', (event) => {
			console.log('about-send-message', event);
		});

		const unlistenShortcut = onListen('shortcut-triggered', (event) => {
			console.log('shortcut-triggered', event);
		});

		return () => {
			unlistenProgress.then((unlisten) => unlisten());
			unlistenAboutPromise.then((unlisten) => unlisten());
			unlistenDownloadInfo.then((unlisten) => unlisten());
			unlistenShortcut.then((unlisten) => unlisten());
		};
	}, []);

	async function greet() {
		const res: string = await invoke('greet_name', { name: url });
		setGreetMsg(res);
	}

	function saveFile() {
		saveFileWithPicker({
			content: '这是一个测试文件',
			file_name: 'document.txt',
		});
	}

	// 下载文件
	const downloadFile = async (url: string, filename?: string) => {
		await donwnloadWithUrl({ url, file_name: filename }, setDownloadFileInfo);
	};

	const sendMessage = async () => {
		await onEmit('message', {
			message: 'hello world',
		});
	};

	const getUserInfo = async () => {
		const res = await getUserProfile(2);
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
		const downloadUrl = `${import.meta.env.VITE_DEV_DOMAIN}${res.data}`;
		await donwnloadWithUrl({ url: downloadUrl });
	};

	const onDownloadZip = async () => {
		const res = await downloadZip('ppp.pdf');
		await downloadBlob(
			{
				file_name: 'test.zip',
				overwrite: true,
				id: Date.now().toString(),
			},
			res.data,
		);
	};

	return (
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
			{downloadFileInfo.length > 0 && (
				<div className="mb-8 w-full max-w-2xl">
					<h3 className="text-lg font-bold mb-2">下载历史-INFO</h3>
					<div className="space-y-2 max-h-60 overflow-y-auto">
						{downloadFileInfo.map((result, index) => (
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
											: result.success === 'error'
												? '❌ 失败'
												: '🚀 开始'}
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
					onClick={() => donwnloadWithUrl({ url })}
				>
					download pdf File with url
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
