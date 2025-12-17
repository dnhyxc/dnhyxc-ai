import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const Home = () => {
	const [greetMsg, setGreetMsg] = useState('');
	const [name, setName] = useState('');
	const [downloadResults, setDownloadResults] = useState<any[]>([]);
	const [downloadFileInfo, setDownloadFileInfo] = useState<
		{
			file_path: string;
			file_name: string;
			id: string;
		}[]
	>([]);
	const [downloadProgressInfo, setDownloadProgressInfo] = useState<
		{
			percent: number;
			filename: string;
			id: string;
			status: boolean;
		}[]
	>([]);

	// 在组件中添加进度监听
	useEffect(() => {
		const unlistenPromise = listen('download://progress', (event) => {
			const progress = event.payload as {
				url: string;
				total_bytes: number;
				content_length: number;
				percent: number;
				file_path: string;
				filename: string;
				id: string;
				status: boolean;
			};

			const info = {
				percent: progress.percent,
				filename: progress.file_path.split('/').pop() || '',
				id: progress.id,
				status: progress.status,
			};

			setDownloadProgressInfo((prev) => {
				const idx = prev.findIndex((item) => item.id === info.id);
				if (idx === -1) {
					return [...prev, info];
				}
				const next = [...prev];
				next[idx] = {
					...next[idx],
					percent: info.percent,
					status: info.status,
					filename: info.filename,
				};
				return next;
			});
		});

		const unlistenFileInfoPromise = listen('download://file_info', (event) => {
			const info = event.payload as {
				file_path: string;
				file_name: string;
				id: string;
			};
			console.log('file-info', info);
			setDownloadFileInfo((prev) => [info, ...prev]);
		});

		return () => {
			unlistenPromise.then((unlisten) => unlisten());
			unlistenFileInfoPromise.then((unlisten) => unlisten());
		};
	}, []);

	const openChildWindow = async () => {
		const webview = new WebviewWindow('child-window', {
			url: 'https://dnhyxc.cn',
			width: 1000,
			height: 690,
			resizable: true,
			decorations: true,
			title: 'Tauri + React',
			center: true,
		});
		// since the webview window is created asynchronously,
		// Tauri emits the `tauri://created` and `tauri://error` to notify you of the creation response
		webview.once('tauri://created', function () {
			// webview window successfully created
			console.log('webview window successfully created');
		});
		webview.once('tauri://error', function (e: any) {
			// an error occurred during webview window creation
			console.log('webview window error', e);
		});
	};

	async function greet() {
		// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
		setGreetMsg(await invoke('greet', { name }));
	}

	async function saveFile() {
		const result = await invoke('save_file_with_picker', {
			options: {
				content: '这是一个测试文件',
				file_name: 'document.txt',
			},
		});

		console.log(result, 'result');

		// if (result.success) {
		// 	alert(`文件保存成功: ${result.file_path}`);
		// } else {
		// 	alert(`保存失败: ${result.message}`);
		// }
	}

	// 下载文件
	const downloadFile = async (fileUrl: string, fileName?: string) => {
		if (!fileUrl.trim()) {
			alert('请输入文件的 URL');
			return;
		}

		try {
			// 可选：先获取文件信息
			const fileInfo = await invoke('get_file_info', {
				url: fileUrl,
			});
			console.log('文件信息:', fileInfo);
			// 下载文件
			const result: any = await invoke('download_file', {
				options: {
					url: fileUrl,
					file_name: fileName || undefined, // 如果用户输入了文件名则使用，否则自动获取
					// save_dir: './downloads',
					overwrite: true, // 覆盖已存在的文件
					id: Date().valueOf(),
				},
			});
			console.log('下载结果:', result);
			setDownloadResults((prev) => [result, ...prev]);
			if (result.success) {
				console.log('文件保存成功:', result.file_path);
				alert(
					`文件下载成功！\n保存路径: ${result.file_path}\n文件大小: ${result.file_size} 字节\n类型: ${result.content_type || '未知'}`,
				);
			} else {
				alert(`下载失败: ${result.message}`);
			}
		} catch (error) {
			console.error('下载失败:', error);
			alert(`下载失败: ${error}`);
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
						文件名称: {i.filename}
						下载进度: {i.percent}% 下载状态: {i.status ? '完成' : '进行中'}
					</div>
				))}
			</div>
			{downloadResults.length > 0 && (
				<div className="mb-8 w-full max-w-2xl">
					<h3 className="text-lg font-bold mb-2">下载历史</h3>
					<div className="space-y-2 max-h-60 overflow-y-auto">
						{downloadResults.map((result, index) => (
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
										{result.success ? '✅ 成功' : '❌ 失败'}
									</span>
									<span className="text-sm text-gray-500">
										{result.file_size
											? `${(result.file_size / 1024).toFixed(1)} KB`
											: '未知大小'}
									</span>
								</div>
								{result.file_path && (
									<p className="text-sm truncate">路径: {result.file_path}</p>
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
				<div className="flex gap-2">
					<Input
						id="greet-input"
						onChange={(e) => setName(e.currentTarget.value)}
						placeholder="Enter a name..."
					/>
					<Button className="cursor-pointer">Greet</Button>
				</div>
			</form>
			<p className="my-10 text-lg font-medium text-foreground">{greetMsg}</p>
			<Button
				variant="default"
				className="cursor-pointer"
				onClick={openChildWindow}
			>
				Open Child Window
			</Button>
			<Button variant="default" className="cursor-pointer" onClick={saveFile}>
				Save File
			</Button>
			<Button
				variant="default"
				className="cursor-pointer"
				onClick={
					() =>
						// downloadFile(
						// 	'https://dnhyxc.cn:9216/files/__FILE__c7ee5b931b68b9e227fd94957587796d.epub',
						// )
						// downloadFile(
						// 	'https://dnhyxc.cn:9216/files/__FILE__86960f6b9b59b7d5cd9a1dfe9a6f88a0.docx',
						// )
						downloadFile(
							'https://dnhyxc.cn:9216/files/__FILE__88872d9ec263023cc77d8df9595e69c2.pdf',
						)
					// downloadFile(
					// 	'https://files.codelife.cc/wallhaven/full/wq/wallhaven-wqkw2r.jpg?x-oss-process=image/resize,limit_0,m_fill,w_2560,h_1440/quality,Q_93/format,webp',
					// )
				}
			>
				download File
			</Button>
			<Button
				variant="default"
				className="cursor-pointer"
				onClick={
					() =>
						// downloadFile(
						// 	'https://dnhyxc.cn:9216/files/__FILE__c7ee5b931b68b9e227fd94957587796d.epub',
						// )
						// downloadFile(
						// 	'https://dnhyxc.cn:9216/files/__FILE__86960f6b9b59b7d5cd9a1dfe9a6f88a0.docx',
						// )
						downloadFile(
							'https://dnhyxc.cn:9216/files/__FILE__88872d9ec263023cc77d8df9595e69c2.pdf',
						)
					// downloadFile(
					// 	'https://files.codelife.cc/wallhaven/full/wq/wallhaven-wqkw2r.jpg?x-oss-process=image/resize,limit_0,m_fill,w_2560,h_1440/quality,Q_93/format,webp',
					// )
				}
			>
				download pdf File
			</Button>
		</div>
	);
};

export default Home;
