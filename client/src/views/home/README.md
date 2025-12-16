```tsx
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Home = () => {
	const [greetMsg, setGreetMsg] = useState("");
	const [name, setName] = useState("");
	const [fileUrl, setFileUrl] = useState("");
	const [fileName, setFileName] = useState("");
	const [downloadResults, setDownloadResults] = useState<any[]>([]);

	// ... 原有的 openChildWindow, greet, saveFile 函数 ...

	// 下载文件
	async function downloadFile() {
		if (!fileUrl.trim()) {
			alert("请输入文件的 URL");
			return;
		}

		try {
			console.log("开始下载文件:", fileUrl);

			// 可选：先获取文件信息
			const fileInfo = await invoke("get_file_info", {
				url: fileUrl,
			});
			console.log("文件信息:", fileInfo);

			// 下载文件
			const result = await invoke("download_file", {
				options: {
					url: fileUrl,
					file_name: fileName || undefined, // 如果用户输入了文件名则使用，否则自动获取
					save_dir: "./downloads",
					overwrite: true, // 覆盖已存在的文件
				},
			});

			console.log("下载结果:", result);
			setDownloadResults((prev) => [result, ...prev]);

			if (result.success) {
				alert(
					`文件下载成功！\n保存路径: ${result.file_path}\n文件大小: ${
						result.file_size
					} 字节\n类型: ${result.content_type || "未知"}`
				);
			} else {
				alert(`下载失败: ${result.message}`);
			}
		} catch (error) {
			console.error("下载失败:", error);
			alert(`下载失败: ${error}`);
		}
	}

	// 批量下载示例
	async function downloadSampleFiles() {
		const files = [
			{
				url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
				file_name: "sample.pdf",
			},
			{
				url: "https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore",
				file_name: "Node.gitignore",
			},
			{
				url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
				file_name: "sample.jpg",
			},
		];

		try {
			const results = await invoke("download_files", {
				files,
			});

			console.log("批量下载结果:", results);
			setDownloadResults((prev) => [...results, ...prev]);

			const successCount = results.filter((r) => r.success).length;
			alert(`批量下载完成！成功: ${successCount}/${files.length}`);
		} catch (error) {
			console.error("批量下载失败:", error);
			alert(`批量下载失败: ${error}`);
		}
	}

	return (
		<div className="w-full h-full flex flex-col items-center m-0 p-4 overflow-auto">
			<h1 className="text-3xl font-bold mb-8 text-green-600">
				Welcome to dnhyxc-ai
			</h1>

			{/* 文件下载功能 */}
			<div className="mb-8 w-full max-w-2xl">
				<h2 className="text-xl font-bold mb-4">通用文件下载</h2>
				<div className="space-y-4 mb-4">
					<div className="flex gap-2">
						<Input
							type="url"
							placeholder="输入文件 URL..."
							value={fileUrl}
							onChange={(e) => setFileUrl(e.currentTarget.value)}
							className="flex-1"
						/>
					</div>
					<div className="flex gap-2">
						<Input
							placeholder="自定义文件名 (可选)..."
							value={fileName}
							onChange={(e) => setFileName(e.currentTarget.value)}
							className="flex-1"
						/>
						<Button
							onClick={downloadFile}
							className="cursor-pointer bg-blue-600 hover:bg-blue-700"
						>
							下载文件
						</Button>
						<Button
							onClick={downloadSampleFiles}
							variant="outline"
							className="cursor-pointer"
						>
							批量示例
						</Button>
					</div>
					<p className="text-sm text-gray-500">
						支持所有常见文件类型: PDF, 图片(JPEG/PNG/GIF), 文档(DOC/XLS/PPT),
						视频(MP4/AVI), 音频(MP3/WAV), 压缩包(ZIP/RAR), 文本文件等
					</p>
				</div>
			</div>

			{/* 下载历史 */}
			{downloadResults.length > 0 && (
				<div className="mb-8 w-full max-w-2xl">
					<h3 className="text-lg font-bold mb-2">下载历史</h3>
					<div className="space-y-2 max-h-60 overflow-y-auto">
						{downloadResults.map((result, index) => (
							<div
								key={index}
								className={`p-3 rounded border ${
									result.success
										? "bg-green-50 border-green-200"
										: "bg-red-50 border-red-200"
								}`}
							>
								<div className="flex justify-between items-center">
									<span className="font-medium">
										{result.success ? "✅ 成功" : "❌ 失败"}
									</span>
									<span className="text-sm text-gray-500">
										{result.file_size
											? `${(result.file_size / 1024).toFixed(1)} KB`
											: "未知大小"}
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

			{/* 原有的表单和按钮 */}
			<div className="mb-8">
				<form
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
			</div>

			<p className="my-4 text-lg font-medium text-foreground">{greetMsg}</p>

			<div className="flex gap-4">
				<Button
					variant="default"
					className="cursor-pointer"
					onClick={openChildWindow}
				>
					Open Child Window
				</Button>
				<Button variant="outline" className="cursor-pointer" onClick={saveFile}>
					保存文件
				</Button>
			</div>
		</div>
	);
};

export default Home;
```
