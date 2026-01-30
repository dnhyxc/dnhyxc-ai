import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/styles.css';
import DragUpload from '@design/DragUpload';
import Markdown from '@design/Markdown';
import {
	Button,
	ScrollArea,
	Spinner,
	Switch,
	Textarea,
	Toast,
} from '@ui/index';
import { motion } from 'framer-motion';
import {
	CheckCircle,
	Copy,
	FileCheck,
	FileSpreadsheet,
	FileText,
	Sparkle,
	Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/hooks';
import { uploadFile } from '@/service';
import { streamFetch } from '@/utils/sse';

interface UploadFileInfo {
	originalname: string;
	filename: string;
	mimetype: string;
	url: string;
	path: string;
	size: number;
}

const DocumentProcessor = () => {
	const [uploadFileInfo, setUploadFileInfo] =
		useState<Partial<UploadFileInfo>>();
	const [loading, setLoading] = useState(false);
	const [selectedFormat, setSelectedFormat] = useState('image');
	const [copied, setCopied] = useState(false);
	const [content, setContent] = useState('');
	const [prompt, setPrompt] = useState('');
	const [onlineUrl, setOnlineUrl] = useState('');
	const [fileType, setFileType] = useState(false);

	const stopRequestRef = useRef<(() => void) | null>(null);
	const dragUploadRef = useRef<{ onClear: () => void } | null>(null);

	let timer: ReturnType<typeof setTimeout> | null = null;

	const { theme } = useTheme();

	// 1. 初始化解析器
	const parser = useMemo(() => {
		return new MarkdownParser();
	}, []);

	useEffect(() => {
		return () => {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		};
	}, []);

	const formats = [
		{
			id: 'image',
			label: 'Image 图片',
			icon: FileSpreadsheet,
			color: 'from-green-500 to-emerald-500',
		},
		{
			id: 'pdf',
			label: 'PDF 文档',
			icon: FileCheck,
			color: 'from-red-500 to-orange-500',
		},
		{
			id: 'word',
			label: 'Word 文档',
			icon: FileText,
			color: 'from-blue-500 to-indigo-500',
		},
		{
			id: 'excel',
			label: 'Excel 表格',
			icon: FileSpreadsheet,
			color: 'from-green-500 to-emerald-500',
		},
	];

	const onSelectFormat = (id: string) => {
		setSelectedFormat(id);
		dragUploadRef.current?.onClear?.();
		setUploadFileInfo({});
	};

	const onCopy = () => {
		navigator.clipboard.writeText(content);
		setCopied(true);
		timer = setTimeout(() => setCopied(false), 2000);
	};

	const onUploadFile = async (file: File) => {
		const res = await uploadFile(file);
		if (res.success) {
			Toast({
				type: 'success',
				title: '文件上传成功',
			});
			setUploadFileInfo({
				...res.data,
				url: import.meta.env.VITE_DEV_DOMAIN + res.data.path,
			});
		}
	};

	const onPromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setPrompt(e.target.value);
	};

	const onOnlineUrlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setOnlineUrl(e.target.value);
	};

	const onCheckedChange = (value: boolean) => {
		if (value) {
			setUploadFileInfo({});
		} else {
			setOnlineUrl('');
		}
		setFileType(value);
	};

	// 开始生成
	const onStart = async () => {
		setContent('');
		// 调用工具函数，它会立即返回一个 stop 函数
		const stop = await streamFetch({
			options: {
				body: JSON.stringify({
					url: uploadFileInfo?.url || onlineUrl,
					prompt,
				}),
			},
			callbacks: {
				onStart: () => {
					setLoading(true);
				},
				// 				const onParser = () => {
				// 	const htmlContent = parser.render(markdown);
				// 	console.log(htmlContent, 'htmlContent');
				// 	setHtmlContent(htmlContent);
				// };
				onData: (chunk) => setContent((prev) => prev + chunk),
				onError: (err, type) => {
					setLoading(false);
					Toast({
						type: type || 'error',
						title: err?.message || String(err) || '解析失败',
					});
				},
				onComplete: () => {
					setLoading(false);
				},
			},
		});

		// 保存 stop 函数以便后续调用
		stopRequestRef.current = stop;
	};

	// 停止生成
	const onStop = () => {
		if (stopRequestRef.current) {
			stopRequestRef.current();
			stopRequestRef.current = null;
			setLoading(false);
		}
	};

	const handleStart = () => {
		if (loading) {
			onStop();
		} else {
			onStart();
		}
	};

	console.log(content, 'content');

	return (
		<div className="w-full h-full flex flex-col justify-center items-center relative overflow-hidden rounded-b-md">
			<ScrollArea className="pb-5.5 overflow-y-auto w-full h-full backdrop-blur-sm">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="max-w-6xl mx-auto space-y-6"
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.5 }}
						className="relative rounded-2xl backdrop-blur-xl overflow-hidden"
					>
						<div className="p-5 pb-0">
							<p className="text-textcolor/70 mb-6">
								支持 PDF、Word、Excel、Image
								等多种格式的智能解析、总结和内容提取
							</p>
							<div className="flex justify-between mb-6">
								<div className="flex flex-wrap gap-5">
									{formats.map((format) => {
										const Icon = format.icon;
										const isActive = selectedFormat === format.id;
										return (
											<Button
												key={format.id}
												onClick={() => onSelectFormat(format.id)}
												className="relative cursor-pointer px-4 py-2 rounded-md font-medium transition-all duration-300 bg-theme-white/5 hover:bg-theme-white/10 text-textcolor"
											>
												{isActive && (
													<motion.div
														layoutId="activeFormat"
														className="absolute inset-0 rounded-md bg-linear-to-r from-blue-600 to-cyan-600 -z-1"
													/>
												)}
												<div className="flex items-center gap-2">
													<Icon className="w-4 h-4 text-textcolor" />
													{format.label}
												</div>
											</Button>
										);
									})}
								</div>
								<Button
									variant="secondary"
									disabled={!uploadFileInfo?.url && !onlineUrl}
									className="cursor-pointer flex justify-center min-w-30 bg-linear-to-r from-blue-500 to-cyan-500"
									onClick={handleStart}
								>
									{loading ? (
										<span className="flex items-center">
											<Spinner className="text-textcolor mr-2" />
											停止分析
										</span>
									) : (
										<span className="flex items-center">
											<Sparkle className="w-12 h-12 mr-2" />
											{content ? '重新分析' : '开始分析'}
										</span>
									)}
								</Button>
							</div>

							<div className="flex justify-between items-center h-46 gap-5">
								<div className="flex-1 h-full flex flex-col rounded-xl backdrop-blur-xl overflow-hidden">
									<div className="px-3 py-3 h-11 rounded-t-xl bg-theme/10 border border-b-0 border-theme-white/10 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Switch
												checked={fileType}
												onCheckedChange={onCheckedChange}
											>
												{fileType ? '在线地址' : '上传文件'}
											</Switch>
										</div>
										<div className="text-xs text-textcolor/50">
											{fileType
												? '支持合法的在线图片地址'
												: '支持 PDF, DOCX, XLSX, PNG, JPEG, JPG'}
										</div>
									</div>
									<div className="p-0 h-full flex flex-1">
										{fileType ? (
											<Textarea
												spellCheck={false}
												placeholder="请输入在线图片地址"
												maxLength={200}
												value={onlineUrl}
												className="flex-1 resize-none border rounded-b-xl border-theme/10 focus-visible:border-theme/20 bg-theme/5 rounded-t-none focus-visible:ring-transparent"
												onChange={onOnlineUrlChange}
											/>
										) : (
											<DragUpload
												ref={dragUploadRef}
												className="flex-1 rounded-b-xl h-35 bg-theme/5"
												uploadFile={onUploadFile}
											/>
										)}
									</div>
								</div>
								<div className="flex-1 h-full flex flex-col">
									<div className="flex items-center justify-between rounded-t-xl h-11 border border-b-0 border-theme-white/10 bg-theme/10 w-full px-3 py-3">
										<div className="flex flex-1 items-center justify-between gap-2">
											<span className="text-sm font-medium text-textcolor">
												设置提示词
											</span>
											<div className="text-xs  text-textcolor/50">
												最大输入 200 字
											</div>
										</div>
									</div>
									<Textarea
										spellCheck={false}
										placeholder="请输入提示词"
										maxLength={200}
										value={prompt}
										className="flex-1 resize-none border rounded-b-xl border-theme/10 focus-visible:border-theme/20 bg-theme/5 rounded-t-none focus-visible:ring-transparent"
										onChange={onPromptChange}
									/>
								</div>
							</div>

							{content && (
								<div className="space-y-4">
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										className="mt-5.5 border border-theme-white/10 rounded-xl bg-theme/5 backdrop-blur-xl overflow-hidden"
									>
										<div className="px-4 py-3 h-11.5 border-b border-theme-white/10 bg-theme/5 flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Sparkles className="w-4 h-4 text-purple-400" />
												<span className="text-sm font-medium text-slate-300">
													智能分析结果
												</span>
											</div>
											<motion.button
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												onClick={onCopy}
												className="flex items-center gap-2 px-3 py-1 rounded-lg bg-theme-white/5 hover:bg-theme-white/10 border border-theme-white/10 transition-all duration-300"
											>
												{copied ? (
													<>
														<CheckCircle className="w-4 h-4 text-green-400" />
														<span className="text-sm text-green-400">
															已复制
														</span>
													</>
												) : (
													<>
														<Copy className="w-4 h-4 text-slate-400" />
														<span className="text-sm text-slate-400">复制</span>
													</>
												)}
											</motion.button>
										</div>
										<Markdown
											value={content}
											theme={theme === 'black' ? 'dark' : 'light'}
											background="transparent"
										/>
										<div
											dangerouslySetInnerHTML={{
												__html: parser.render(content),
											}}
										/>
									</motion.div>
								</div>
							)}
						</div>
					</motion.div>
				</motion.div>
			</ScrollArea>
		</div>
	);
};

export default DocumentProcessor;
