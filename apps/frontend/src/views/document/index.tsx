import DragUpload from '@design/DragUpload';
import Markdown from '@design/Markdown';
import { Button, ScrollArea, Spinner, Toast, Textarea } from '@ui/index';
import { motion } from 'framer-motion';
import {
	CheckCircle,
	Copy,
	FileCheck,
	FileSpreadsheet,
	FileText,
	Sparkle,
	Sparkles,
	Upload,
	ClipboardPenLine,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '@/hooks';
import { imageOcr, uploadFile as upload_file } from '@/service';

const DocumentProcessor = () => {
	const [uploadFileInfo, setUploadFileInfo] = useState<any>({});
	const [loading, setLoading] = useState(false);
	const [selectedFormat, setSelectedFormat] = useState('image');
	const [analyzedContent, setAnalyzedContent] = useState('');
	const [copied, setCopied] = useState(false);

	const { theme } = useTheme();

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

	const handleCopy = () => {
		navigator.clipboard.writeText(analyzedContent);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const uploadFile = async (file: File) => {
		const res = await upload_file(file);
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

	const onAnalysis = async () => {
		try {
			setLoading(true);
			const res = await imageOcr(uploadFileInfo?.url);
			if (res.success) {
				Toast({
					type: 'success',
					title: '解析成功',
				});
				setAnalyzedContent(res.data);
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center relative overflow-hidden rounded-b-md">
			<ScrollArea className="overflow-y-auto w-full h-full backdrop-blur-sm">
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
						<div className="p-5">
							<p className="text-slate-400 mb-6">
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
												onClick={() => setSelectedFormat(format.id)}
												className="relative cursor-pointer px-4 py-2 rounded-md font-medium transition-all duration-300 bg-white/5 hover:bg-white/10 text-textcolor"
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
									disabled={!uploadFileInfo?.url || loading}
									className="cursor-pointer flex justify-center min-w-30 bg-linear-to-r from-blue-500 to-cyan-500"
									onClick={onAnalysis}
								>
									{loading ? (
										<Spinner className="text-textcolor" />
									) : (
										<Sparkle className="w-12 h-12" />
									)}
									开始分析
								</Button>
							</div>

							<div className="flex justify-between items-center h-46 gap-5">
								<div className="flex-1 rounded-xl bg-theme/5 backdrop-blur-xl overflow-hidden">
									<div className="px-3 py-3 rounded-t-xl border border-b-0 border-white/10 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<Upload className="w-4 h-4 text-blue-400" />
											<span className="text-sm font-medium text-textcolor">
												上传文件
											</span>
										</div>
										<div className="text-xs text-textcolor/50">
											支持 PDF, DOCX, XLSX, PNG, JPEG, JPG
										</div>
									</div>
									<div className="p-0">
										<DragUpload
											className="rounded-b-xl h-35"
											uploadFile={uploadFile}
										/>
									</div>
								</div>
								<div className="flex-1 h-full flex flex-col">
									<div className="px-3 py-3 rounded-t-xl border border-b-0 border-white/10 bg-theme/5 flex items-center justify-between">
										<div className="flex items-center gap-2">
											<ClipboardPenLine className="w-4 h-4 text-blue-400" />
											<span className="text-sm font-medium text-textcolor">
												设置提示词
											</span>
										</div>
										<div className="text-xs  text-textcolor/50">
											最大输入 200 字
										</div>
									</div>
									<Textarea
										spellCheck={false}
										placeholder="请输入提示词"
										maxLength={200}
										className="flex-1 resize-none border rounded-b-xl border-theme/10 focus-visible:border-theme/20 bg-theme/5 rounded-t-none focus-visible:ring-transparent"
									/>
								</div>
							</div>

							{analyzedContent && (
								<div className="space-y-4">
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										className="mt-5.5 border border-white/10 rounded-xl bg-theme/5 backdrop-blur-xl overflow-hidden"
									>
										<div className="px-4 py-3 h-11.5 border-b border-white/10 bg-theme/5 flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Sparkles className="w-4 h-4 text-purple-400" />
												<span className="text-sm font-medium text-slate-300">
													智能分析结果
												</span>
											</div>
											<motion.button
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												onClick={handleCopy}
												className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
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
											value={analyzedContent}
											theme={theme === 'black' ? 'dark' : 'light'}
											background="transparent"
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
