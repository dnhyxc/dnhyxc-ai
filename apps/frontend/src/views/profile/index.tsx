import { Button } from '@ui/button';
import { Input } from '@ui/input';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import * as qiniu from 'qiniu-js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import DragUpload from '@/components/design/DragUpload';
import {
	downloadFile as download,
	downloadZip,
	getUploadToken,
	getUserProfile,
} from '@/service';
import type { DownloadProgress, DownloadResult } from '@/types';
import {
	createDownloadProgressListener,
	createUnlistenFileInfoListener,
	donwnloadWithUrl,
	downloadBlob,
	getValue,
	onCreateWindow,
	onEmit,
	onListen,
	saveFileWithPicker,
} from '@/utils';
import { isTauriRuntime } from '@/utils/runtime';

interface UploadInfo {
	percent: number;
	loaded: number;
	size: number;
}

const Profile = () => {
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
	const [selectFile, setSelectFile] = useState<File | null>(null);
	const [domainUrls, setDomainUrls] = useState<string[]>([]);
	const [uploadInfos, setUploadInfos] = useState<UploadInfo[]>([]);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const navigate = useNavigate();

	// 在组件中添加进度监听
	useEffect(() => {
		const unlistenProgress = createDownloadProgressListener(
			setDownloadProgressInfo,
		);

		const unlistenDownloadInfo =
			createUnlistenFileInfoListener(setDownloadFileInfo);

		const unlistenAboutPromise = onListen('about-send-message', (event) => {
			console.log('about-send-message', event);
		});

		const unlistenShortcut = onListen('shortcut-triggered', async (event) => {
			if (event === 'new_workflow') {
				Toast({
					title: '快捷键触发',
					type: 'success',
					message: '新建工作流',
				});
			}
			if (event === 'open_subwindow') {
				const theme = (await getValue('theme')) as 'dark' | 'light';
				onCreateWindow({
					url: '/win',
					width: 1000,
					height: 690,
					theme,
				});
			}
		});

		return () => {
			unlistenProgress.then((unlisten) => unlisten());
			unlistenAboutPromise.then((unlisten) => unlisten());
			unlistenDownloadInfo.then((unlisten) => unlisten());
			unlistenShortcut.then((unlisten) => unlisten());
		};
	}, []);

	const onOpenWindow = async () => {
		const theme = (await getValue('theme')) as 'dark' | 'light';
		onCreateWindow({
			url: '/win',
			width: 1000,
			height: 690,
			theme,
		});
	};

	async function greet() {
		if (!isTauriRuntime()) {
			setGreetMsg('（浏览器预览：此演示需桌面客户端）');
			return;
		}
		const { invoke } = await import('@tauri-apps/api/core');
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

	const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files?.[0]) {
			setSelectFile(e.target.files?.[0]);
		}
	};

	const observer = useMemo(() => {
		return {
			next(res: { total: UploadInfo }) {
				setUploadInfos((prev) => [res.total, ...prev]);
			},
			error() {
				// ...
			},
			complete(res: { key: string; hash: string }) {
				const url = import.meta.env.VITE_QINIU_DOMAIN + res.key;
				setDomainUrls((prev) => [url, ...prev]);
			},
		};
	}, []);

	const onSelectFile = () => {
		fileInputRef?.current?.click();
	};

	const uploadFile = async (file: File) => {
		const res = await getUploadToken();
		const putExtra = {};
		const config = {};
		const observable = qiniu.upload(
			file,
			file.name,
			res.data, // token
			putExtra,
			config,
		);
		observable.subscribe(observer); // 上传开始
	};

	const onUpload = async () => {
		if (selectFile) {
			uploadFile(selectFile);
		}
	};

	return (
		<div className="w-full h-full flex m-0 overflow-hidden">
			<ScrollArea className="w-full overflow-y-auto p-2.5">
				<h1 className="text-3xl font-bold mb-10 text-green-600">
					Welcome to dnhyxc-ai
					<Button
						className="ml-5 cursor-pointer"
						onClick={() => navigate('/account')}
					>
						修改个人信息
					</Button>
				</h1>
				<div className="w-full h-full mb-10">
					<DragUpload uploadFile={uploadFile} />
					<Input
						ref={fileInputRef}
						type="file"
						onChange={onChange}
						placeholder="选择文件"
						className="hidden"
					/>
					<div className="mt-5">
						<Button className="mr-2 cursor-pointer" onClick={onSelectFile}>
							选择文件
						</Button>
						<Button className="cursor-pointer" onClick={onUpload}>
							上传
						</Button>
					</div>
					{uploadInfos.length > 0
						? uploadInfos.map((i, key) => {
								return (
									<div key={key}>
										{i.size ? (
											<div>文件大小：{Math.round(i.size / 1024)}KB</div>
										) : null}
										{i.percent ? (
											<div>上传进度：{Math.round(i.percent)}%</div>
										) : null}
									</div>
								);
							})
						: null}
					{domainUrls.length > 0
						? domainUrls.map((i, key) => {
								return (
									<div key={key}>
										<img src={i} alt="图片" />
									</div>
								);
							})
						: null}
				</div>
				<div className="overflow-y-auto">
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
										<p className="text-sm truncate">
											文件名: {result.file_name}
										</p>
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
										<p className="text-sm truncate">
											文件名: {result.file_name}
										</p>
									)}
									<p className="text-sm">{result.message}</p>
								</div>
							))}
						</div>
					</div>
				)}
				<form
					className="flex justify-center"
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
				<div className="flex justify-center items-center gap-4 mt-10">
					<Button
						variant="default"
						className="cursor-pointer"
						onClick={onOpenWindow}
					>
						Open Child Window
					</Button>
					<Button className="cursor-pointer" onClick={sendMessage}>
						Send Message
					</Button>
					<Button className="cursor-pointer" onClick={getUserInfo}>
						获取用户信息
					</Button>
				</div>
				<div className="flex justify-center items-center gap-4 mt-10">
					<Button
						variant="default"
						className="cursor-pointer"
						onClick={saveFile}
					>
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
			</ScrollArea>
		</div>
	);
};

export default Profile;
