import { motion } from 'framer-motion';
import {
	CheckCircle,
	Copy,
	FileCheck,
	FileJson,
	FileSpreadsheet,
	FileText,
	Sparkles,
	Upload,
} from 'lucide-react';
import { useState } from 'react';

const DocumentProcessor = () => {
	const [file, setFile] = useState<File | null>(null);
	const [selectedFormat, setSelectedFormat] = useState('pdf');
	const [analyzed, setAnalyzed] = useState(false);
	const [copied, setCopied] = useState(false);
	const [selectedContent, setSelectedContent] = useState('');

	const formats = [
		{
			id: 'pdf',
			label: 'PDF文档',
			icon: FileCheck,
			color: 'from-red-500 to-orange-500',
		},
		{
			id: 'word',
			label: 'Word文档',
			icon: FileText,
			color: 'from-blue-500 to-indigo-500',
		},
		{
			id: 'excel',
			label: 'Excel表格',
			icon: FileSpreadsheet,
			color: 'from-green-500 to-emerald-500',
		},
	];

	const mockAnalysis = {
		pdf: {
			title: '产品需求文档 v2.4',
			tags: ['需求分析', '产品规划', '功能定义'],
			stats: {
				totalPages: 24,
				words: 15234,
				figures: 18,
				tables: 5,
			},
			summary: `这是一份关于新版产品功能规划的需求文档，共24页，包含详细的功能定义、用户流程图和技术实现方案。

**核心功能概览：**
- 新增AI智能推荐系统
- 支持多设备无缝同步
- 增强数据安全保护机制
- 优化用户交互体验

**技术架构亮点：**
采用微服务架构设计，支持水平扩展，确保高并发场景下的系统稳定性。前端采用React框架，后端基于Node.js服务。

**关键里程碑：**
- 第一阶段：完成核心功能开发
- 第二阶段：进行用户测试
- 第三阶段：正式发布上线
`,
			extracted: {
				tasks: [
					{
						id: 1,
						title: '实现AI推荐算法',
						priority: 'high',
						status: 'in_progress',
					},
					{
						id: 2,
						title: '优化数据同步机制',
						priority: 'medium',
						status: 'pending',
					},
					{
						id: 3,
						title: '完善安全认证模块',
						priority: 'high',
						status: 'pending',
					},
					{
						id: 4,
						title: '重构前端性能优化',
						priority: 'medium',
						status: 'pending',
					},
				],
				keyPoints: [
					'系统支持多租户架构',
					'集成第三方API服务',
					'实现实时数据更新',
					'提供完整的审计日志',
				],
			},
		},
		word: {
			title: '项目技术方案',
			tags: ['技术方案', '系统设计', '开发计划'],
			stats: {
				totalPages: 12,
				words: 8932,
				figures: 6,
				tables: 3,
			},
			summary: `项目技术方案文档，详细描述了系统的整体架构、技术选型和实施计划。

**技术栈选择：**
- 前端：React 18 + TypeScript + TailwindCSS
- 后端：Node.js + NestJS + PostgreSQL
- 缓存：Redis + Memcached
- 消息队列：RabbitMQ + Kafka

**架构特点：**
1. 模块化设计，职责分离
2. 统一的API网关层
3. 完善的异常处理机制
4. 自动化部署流程
`,
			extracted: {
				tasks: [
					{
						id: 1,
						title: '搭建开发环境',
						priority: 'high',
						status: 'completed',
					},
					{
						id: 2,
						title: '设计数据库模型',
						priority: 'high',
						status: 'completed',
					},
					{
						id: 3,
						title: '开发核心API接口',
						priority: 'high',
						status: 'in_progress',
					},
					{
						id: 4,
						title: '编写单元测试',
						priority: 'medium',
						status: 'pending',
					},
				],
				keyPoints: [
					'支持RESTful和GraphQL API',
					'集成Swagger文档',
					'实现JWT认证',
					'支持CORS配置',
				],
			},
		},
		excel: {
			title: '季度销售数据分析报告',
			tags: ['数据分析', '商业智能', '报告统计'],
			stats: {
				totalPages: 1,
				words: 0,
				figures: 15,
				tables: 8,
			},
			summary: `Q3季度销售数据分析报告，包含详细的销售数据、趋势分析和预测模型。

**关键数据指标：**
- 总销售额：¥12,450,000
- 同比增长：18.5%
- 客户满意度：92.4%
- 市场份额：12.3%

**销售趋势：**
- 7月份：¥3,200,000
- 8月份：¥4,150,000
- 9月份：¥5,100,000

**主要发现：**
1. 移动端销售增长显著，占比达45%
2. 高端产品线表现突出，毛利率提升3个百分点
3. 新兴市场渠道正在快速增长
`,
			extracted: {
				tasks: [
					{
						id: 1,
						title: '分析销售数据',
						priority: 'high',
						status: 'completed',
					},
					{
						id: 2,
						title: '生成可视化图表',
						priority: 'high',
						status: 'in_progress',
					},
					{
						id: 3,
						title: '撰写分析报告',
						priority: 'medium',
						status: 'pending',
					},
					{ id: 4, title: '制定改进方案', priority: 'high', status: 'pending' },
				],
				keyPoints: [
					'数据来源：CRM系统导出',
					'分析周期：2024年Q3',
					'数据精度：实时更新',
					'支持多维分析',
				],
			},
		},
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFile(selectedFile);
			setAnalyzed(false);
		}
	};

	const handleAnalyze = () => {
		console.log(
			mockAnalysis[selectedFormat as keyof typeof mockAnalysis],
			'mockAnalysis[selectedFormat as keyof typeof mockAnalysis]',
		);
		setAnalyzed(true);
		setSelectedContent(
			JSON.stringify(
				mockAnalysis[selectedFormat as keyof typeof mockAnalysis],
				null,
				2,
			),
		);
	};

	const handleCopy = () => {
		navigator.clipboard.writeText(selectedContent);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case 'completed':
				return 'bg-green-500';
			case 'in_progress':
				return 'bg-blue-500';
			case 'pending':
				return 'bg-yellow-500';
			default:
				return 'bg-gray-500';
		}
	};

	return (
		<div className="w-full h-full flex flex-col">
			<div className="flex-1 p-6 overflow-auto">
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="max-w-6xl mx-auto space-y-6"
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.5 }}
						className="relative border border-white/10 rounded-2xl bg-linear-to-br from-white/5 to-white/0 backdrop-blur-xl overflow-hidden"
					>
						{/* <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" /> */}

						<div className="p-6">
							<h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
								智能文档处理
							</h2>
							<p className="text-slate-400 mb-6">
								支持PDF、Word、Excel等多种格式的智能解析、总结和内容提取
							</p>

							<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
								<div className="lg:col-span-2 space-y-6">
									<div className="flex flex-wrap gap-2">
										{formats.map((format) => {
											const Icon = format.icon;
											const isActive = selectedFormat === format.id;
											return (
												<motion.button
													key={format.id}
													whileHover={{ scale: 1.05 }}
													whileTap={{ scale: 0.95 }}
													onClick={() => setSelectedFormat(format.id)}
													className={`relative px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
														isActive
															? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-500/25'
															: 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-slate-200'
													}`}
												>
													{isActive && (
														<motion.div
															layoutId="activeFormat"
															className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600"
														/>
													)}
													<span className="relative flex items-center gap-2">
														<Icon
															className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`}
														/>
														{format.label}
													</span>
												</motion.button>
											);
										})}
									</div>

									<div className="border border-white/10 rounded-xl bg-slate-800/30 backdrop-blur-xl overflow-hidden">
										<div className="px-4 py-3 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
											<div className="flex items-center gap-2">
												<Upload className="w-4 h-4 text-blue-400" />
												<span className="text-sm font-medium text-slate-300">
													上传文件
												</span>
											</div>
											<div className="text-xs text-slate-500">
												支持 PDF, DOCX, XLSX
											</div>
										</div>
										<div className="p-4">
											<label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-white/10 rounded-xl hover:border-blue-500/50 transition-all duration-300 cursor-pointer bg-white/5 hover:bg-white/10">
												<div className="flex flex-col items-center justify-center pt-5 pb-6">
													{file ? (
														<>
															<FileJson className="w-12 h-12 text-blue-400 mb-3" />
															<p className="text-sm text-slate-300 mb-1">
																{file.name}
															</p>
															<p className="text-xs text-slate-500">
																{(file.size / 1024).toFixed(2)} KB
															</p>
														</>
													) : (
														<>
															<Upload className="w-12 h-12 text-blue-400 mb-3" />
															<p className="text-sm text-slate-300 mb-1">
																点击或拖拽文件到此处
															</p>
															<p className="text-xs text-slate-500">
																支持 PDF, Word, Excel
															</p>
														</>
													)}
												</div>
												<input
													type="file"
													className="hidden"
													onChange={handleFileUpload}
													accept=".pdf,.doc,.docx,.xls,.xlsx"
												/>
											</label>
										</div>
									</div>

									{analyzed && (
										<div className="space-y-4">
											<motion.div
												initial={{ opacity: 0, y: 20 }}
												animate={{ opacity: 1, y: 0 }}
												className="border border-white/10 rounded-xl bg-slate-800/30 backdrop-blur-xl overflow-hidden"
											>
												<div className="px-4 py-3 border-b border-white/10 bg-slate-800/50 flex items-center justify-between">
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
														className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-300"
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
																<span className="text-sm text-slate-400">
																	复制
																</span>
															</>
														)}
													</motion.button>
												</div>
												<div className="p-4 max-h-[500px] overflow-auto">
													<pre className="text-sm font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
														{selectedContent}11111
													</pre>
												</div>
											</motion.div>
										</div>
									)}
								</div>

								<div className="space-y-4">
									<motion.button
										initial={{ opacity: 0, x: 20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: 0.2 }}
										onClick={handleAnalyze}
										whileHover={{ scale: !file || analyzed ? 1 : 1.02 }}
										whileTap={{ scale: !file || analyzed ? 1 : 0.98 }}
										className={`w-full py-4 rounded-xl font-semibold transition-all duration-300 ${
											file && !analyzed
												? 'bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/35'
												: 'bg-white/5 text-slate-400 cursor-not-allowed'
										}`}
									>
										{analyzed ? '分析完成' : '开始智能分析1'}
									</motion.button>

									{analyzed && (
										<motion.div
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											className="border border-white/10 rounded-xl bg-slate-800/30 backdrop-blur-xl overflow-hidden"
										>
											<div className="px-4 py-3 border-b border-white/10 bg-slate-800/50">
												<h3 className="text-sm font-semibold text-slate-300">
													文档信息
												</h3>
											</div>
											<div className="p-4 space-y-3">
												<div>
													<div className="text-xs text-slate-500 mb-1">
														文档标题
													</div>
													<div className="text-sm font-medium text-white">
														{
															mockAnalysis[
																selectedFormat as keyof typeof mockAnalysis
															].title
														}
													</div>
												</div>
												<div>
													<div className="text-xs text-slate-500 mb-1">
														标签
													</div>
													<div className="flex flex-wrap gap-1">
														{mockAnalysis[
															selectedFormat as keyof typeof mockAnalysis
														].tags.map((tag, idx) => (
															<span
																key={idx}
																className="px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-400"
															>
																{tag}
															</span>
														))}
													</div>
												</div>
											</div>
										</motion.div>
									)}

									{analyzed && (
										<motion.div
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.3 }}
											className="border border-white/10 rounded-xl bg-slate-800/30 backdrop-blur-xl overflow-hidden"
										>
											<div className="px-4 py-3 border-b border-white/10 bg-slate-800/50">
												<h3 className="text-sm font-semibold text-slate-300">
													数据统计
												</h3>
											</div>
											<div className="p-4 space-y-3">
												<div className="flex justify-between items-center">
													<span className="text-sm text-slate-400">页数</span>
													<span className="text-sm font-medium text-white">
														{
															mockAnalysis[
																selectedFormat as keyof typeof mockAnalysis
															].stats.totalPages
														}
													</span>
												</div>
												<div className="flex justify-between items-center">
													<span className="text-sm text-slate-400">
														单词/字符数
													</span>
													<span className="text-sm font-medium text-white">
														{
															mockAnalysis[
																selectedFormat as keyof typeof mockAnalysis
															].stats.words
														}
													</span>
												</div>
												<div className="flex justify-between items-center">
													<span className="text-sm text-slate-400">图表</span>
													<span className="text-sm font-medium text-white">
														{
															mockAnalysis[
																selectedFormat as keyof typeof mockAnalysis
															].stats.figures
														}
													</span>
												</div>
												<div className="flex justify-between items-center">
													<span className="text-sm text-slate-400">表格</span>
													<span className="text-sm font-medium text-white">
														{
															mockAnalysis[
																selectedFormat as keyof typeof mockAnalysis
															].stats.tables
														}
													</span>
												</div>
											</div>
										</motion.div>
									)}

									{analyzed && (
										<motion.div
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.4 }}
											className="border border-white/10 rounded-xl bg-slate-800/30 backdrop-blur-xl overflow-hidden"
										>
											<div className="px-4 py-3 border-b border-white/10 bg-slate-800/50">
												<h3 className="text-sm font-semibold text-slate-300">
													提取内容
												</h3>
											</div>
											<div className="p-4 max-h-[200px] overflow-auto space-y-3">
												<div>
													<div className="text-xs text-slate-500 mb-2">
														任务清单
													</div>
													{mockAnalysis[
														selectedFormat as keyof typeof mockAnalysis
													].extracted.tasks.map((task) => (
														<div
															key={task.id}
															className="flex items-center gap-2 p-2 rounded-lg bg-white/5 mb-1"
														>
															<div
																className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`}
															/>
															<span className="text-sm text-slate-300 flex-1">
																{task.title}
															</span>
															<span className="text-xs text-slate-500">
																{task.priority}
															</span>
														</div>
													))}
												</div>
												<div>
													<div className="text-xs text-slate-500 mb-2">
														关键要点
													</div>
													{mockAnalysis[
														selectedFormat as keyof typeof mockAnalysis
													].extracted.keyPoints.map((point, idx) => (
														<div
															key={idx}
															className="flex items-start gap-2 p-2 rounded-lg bg-white/5 mb-1"
														>
															<Sparkles className="w-3 h-3 text-purple-400 mt-0.5 shrink-0" />
															<span className="text-sm text-slate-300">
																{point}
															</span>
														</div>
													))}
												</div>
											</div>
										</motion.div>
									)}
								</div>
							</div>
						</div>
					</motion.div>
				</motion.div>
			</div>
		</div>
	);
};

export default DocumentProcessor;
