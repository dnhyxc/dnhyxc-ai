import { ScrollArea } from '@ui/scroll-area';
import { motion } from 'framer-motion';
import {
	ArrowRight,
	Code2,
	FileText,
	Globe,
	MessageSquare,
	Rocket,
	Shield,
	Sparkles,
	Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { onListen } from '@/utils';

const Home = () => {
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

	useEffect(() => {
		const unlistenAboutPromise = onListen('about-send-message', (event) => {
			console.log('about-send-message', event);
		});

		const unlistenShortcut = onListen('shortcut-triggered', (event) => {
			console.log('shortcut-triggered', event);
		});

		return () => {
			unlistenAboutPromise.then((unlisten) => unlisten());
			unlistenShortcut.then((unlisten) => unlisten());
		};
	}, []);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			const x = (e.clientX / window.innerWidth) * 100;
			const y = (e.clientY / window.innerHeight) * 100;
			setMousePosition({ x, y });
		};

		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, []);

	return (
		<div className="w-full h-full flex flex-col justify-center items-center relative overflow-hidden">
			<div
				className="absolute inset-0 overflow-hidden pointer-events-none"
				style={{
					background: `
						radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(139, 92, 246, 0.15), transparent 30%),
						radial-gradient(circle at 60% 20%, transparent, transparent 50%)
					`,
				}}
			/>
			<div className="absolute inset-0 overflow-hidden">
				{Array.from({ length: 20 }).map((_, i) => (
					<motion.div
						key={i}
						className="absolute w-2 h-2 rounded-full bg-purple-400/30 blur-sm"
						initial={{
							x: Math.random() * 100,
							y: Math.random() * 100,
							scale: 0,
							opacity: 0,
						}}
						animate={{
							scale: Math.random() * 2 + 1,
							opacity: [0, 1, 0],
							x: [null, Math.random() * 100 - 50],
							y: [null, Math.random() * 100 - 50],
						}}
						transition={{
							duration: Math.random() * 10 + 10,
							repeat: Infinity,
							delay: Math.random() * 10,
						}}
					/>
				))}
			</div>

			<div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-linear-to-r from-purple-500/20 via-pink-500/20 to-blue-500/20 blur-3xl animate-pulse" />
			<div
				className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-linear-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 blur-3xl animate-pulse"
				style={{ animationDelay: '1s' }}
			/>

			<ScrollArea className="overflow-y-auto p-5 pt-0 h-full backdrop-blur-sm rounded-b-md">
				<div className="max-w-6xl mx-auto">
					<div className="max-w-6xl mx-auto">
						{/* Hero Section */}
						<motion.div
							initial={{ opacity: 0, scale: 0.95 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.5 }}
							className="relative border border-white/10 rounded-2xl p-8 bg-linear-to-br from-white/5 to-white/0 backdrop-blur-2xl mb-6 overflow-hidden group"
						>
							<div className="absolute inset-0 bg-linear-to-r from-white/5 to-white/0  group-hover:opacity-100 opacity-50 transition-opacity duration-500" />
							<div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
								<div className="flex-1 text-center md:text-left">
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.1 }}
									>
										<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 mb-4">
											<Sparkles className="w-4 h-4 text-purple-400" />
											<span className="text-sm text-purple-300">
												AI 智能助手
											</span>
										</div>
									</motion.div>
									<motion.h2
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.2 }}
										className="text-3xl md:text-5xl font-bold bg-linear-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent mb-6"
									>
										欢迎使用 AI 智能助手
									</motion.h2>
									<motion.p
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.3 }}
										className="text-lg text-gray-300 mb-8 leading-relaxed"
									>
										一款功能强大的智能桌面应用，集成了多种AI工具和实用功能，帮助您更高效地工作和学习
									</motion.p>
									<motion.div
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.4 }}
										className="flex flex-wrap gap-4 justify-center md:justify-start"
									>
										<motion.button
											whileHover={{ scale: 1.05 }}
											whileTap={{ scale: 0.98 }}
											type="button"
											className="relative overflow-hidden group/btn pb-1 px-8 h-12 bg-linear-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300 cursor-pointer"
										>
											<div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />
											<ArrowRight className="inline-block ml-2 w-5 h-5" />
										</motion.button>
										<button
											type="button"
											className="pb-1 px-8 h-12 bg-white/5 backdrop-blur-sm border border-white/10 text-gray-200 rounded-xl font-medium hover:bg-white/10 hover:border-white/20 hover:shadow-lg transition-all duration-300 cursor-pointer"
										>
											了解更多
										</button>
									</motion.div>
								</div>
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className="relative"
								>
									<div className="relative w-48 h-48">
										{/* <motion.div
											animate={{ scale: [1, 1.05, 1], opacity: [0.8, 0.9, 0.8] }}
											transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
											className="absolute inset-0"
										>
											<div className="w-full h-full rounded-2xl bg-linear-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 backdrop-blur-xl border border-white/10 shadow-2xl" />
										</motion.div> */}
										<motion.div
											animate={{
												scale: [1, 1.05, 1],
												opacity: [0.9, 0.95, 0.9],
											}}
											transition={{
												duration: 2.5,
												repeat: Infinity,
												ease: 'easeInOut',
												// delay: 0.1,
											}}
											className="absolute inset-0"
										>
											<div className="w-full h-full rounded-3xl bg-linear-to-br from-purple-500/30 via-pink-500/30 to-blue-500/30 backdrop-blur-xl shadow-xl" />
										</motion.div>
										<motion.div
											animate={{ scale: [1, 1.05, 1], opacity: [1, 0.95, 1] }}
											transition={{
												duration: 2.5,
												repeat: Infinity,
												ease: 'easeInOut',
												// delay: 0.2,
											}}
											className="absolute inset-5"
										>
											<div className="w-full h-full rounded-3xl bg-linear-to-br from-purple-500/40 via-pink-500/40 to-blue-500/40 backdrop-blur-xl shadow-lg flex items-center justify-center">
												<motion.div
													animate={{ scale: [1, 1.1, 1] }}
													transition={{
														duration: 2.5,
														repeat: Infinity,
														ease: 'easeInOut',
													}}
												>
													<Rocket className="w-16 h-16 text-white" />
												</motion.div>
											</div>
										</motion.div>
									</div>
								</motion.div>
							</div>
						</motion.div>
					</div>

					{/* Features Grid */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
					>
						{[
							{
								icon: MessageSquare,
								title: '智能对话',
								subtitle: '自然语言处理',
								desc: '与AI助手进行自然对话，获取实时解答、创作建议、学习辅导等全方位支持',
								color: 'from-green-400 to-cyan-400',
								bg: 'from-green-400/10 to-cyan-400/10',
								border: 'border-green-500/20',
							},
							{
								icon: Code2,
								title: '代码助手',
								subtitle: '编程支持',
								desc: '智能代码生成、调试、优化和解释，支持多种编程语言，提升开发效率',
								color: 'from-orange-400 to-yellow-400',
								bg: 'from-orange-400/10 to-yellow-400/10',
								border: 'border-orange-500/20',
							},
							{
								icon: FileText,
								title: '文档处理',
								subtitle: '智能分析',
								desc: '支持PDF、Word、Excel等多种格式的智能解析、总结和内容提取',
								color: 'from-yellow-400 to-amber-400',
								bg: 'from-yellow-400/10 to-amber-400/10',
								border: 'border-yellow-500/20',
							},
						].map((feature) => (
							<motion.div
								key={feature.title}
								initial={{ opacity: 0, y: 30 }}
								animate={{ opacity: 1, y: 0 }}
								// transition={{ delay: 0.2 + idx * 0.1 }}
								whileHover={{ y: -5 }}
								className="relative rounded-2xl p-6 border border-white/10 bg-linear-to-br from-white/5 to-white/0 backdrop-blur-xl hover:bg-linear-to-br hover:from-white/10 hover:to-white/0 transition-all duration-300 cursor-pointer group"
								style={{
									background: `linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)`,
								}}
							>
								<div
									className={`absolute inset-0 rounded-2xl bg-linear-to-br ${feature.bg} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
								/>
								<div className="relative z-10">
									<motion.div className="flex items-center justify-between mb-5">
										<div>
											<h3 className="text-xl font-semibold text-white mb-1">
												{feature.title}
											</h3>
											<p className="text-sm text-gray-400">
												{feature.subtitle}
											</p>
										</div>
										<div
											className={`relative w-14 h-14 rounded-xl bg-linear-to-br ${feature.color} flex items-center justify-center shadow-lg`}
										>
											<feature.icon className="w-5 h-5 text-white" />
											<div className="absolute inset-0 rounded-xl bg-linear-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
										</div>
									</motion.div>
									<motion.p className="text-gray-400 mb-5 text-sm leading-relaxed">
										{feature.desc}
									</motion.p>
									<motion.div
										className="flex items-center text-sm text-gray-500"
										whileHover={{ x: 5 }}
									>
										<Zap className="w-4 h-4 text-purple-400 mr-2" />
										<span className="text-purple-300">高效智能处理</span>
									</motion.div>
								</div>
							</motion.div>
						))}
					</motion.div>

					{/* Features Showcase */}
					<div className="relative rounded-2xl p-8 border border-white/10 bg-linear-to-br from-white/5 to-white/0 backdrop-blur-xl mb-8 overflow-hidden group">
						<motion.h3
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.2 }}
							className="text-2xl font-bold mb-8 bg-linear-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent"
						>
							特色功能
						</motion.h3>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[
								{
									icon: Rocket,
									title: '快速响应',
									desc: '毫秒级响应速度',
									color: 'from-orange-400 to-yellow-400',
								},
								{
									icon: Shield,
									title: '隐私保护',
									desc: '本地化处理',
									color: 'from-yellow-400 to-orange-400',
								},
								{
									icon: Globe,
									title: '多语言',
									desc: '全球用户支持',
									color: 'from-green-400 to-cyan-400',
								},
								{
									icon: Zap,
									title: '轻量高效',
									desc: '低资源占用',
									color: 'from-green-400 to-emerald-400',
								},
							].map((feature, idx) => (
								<motion.div
									key={feature.title}
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 + idx * 0.1 }}
									whileHover={{ scale: 1.1, y: -3 }}
									className="relative p-6 text-center rounded-2xl border border-white/5 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer group"
								>
									<motion.div
										className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-linear-to-br ${feature.color} flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:shadow-${feature.color.split(' ')[1]}-500/20`}
									>
										<feature.icon className="w-6 h-6 text-white" />
									</motion.div>
									<motion.h4 className="font-semibold text-white mb-2 group-hover:text-purple-300 transition-colors">
										{feature.title}
									</motion.h4>
									<p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
										{feature.desc}
									</p>
								</motion.div>
							))}
						</div>
					</div>

					{/* Quick Start */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.8 }}
						className="relative rounded-2xl p-8 border border-white/10 bg-linear-to-br from-white/5 to-white/0 backdrop-blur-xl mb-8 overflow-hidden group"
					>
						<div className="absolute top-0 right-0 w-32 h-32 bg-linear-to-br from-purple-500/10 to-transparent rounded-full blur-3xl" />
						<h3 className="text-xl font-semibold mb-8 text-white relative z-10">
							快速开始
						</h3>
						<div className="space-y-4">
							{[
								{
									step: '1',
									title: '安装应用',
									desc: '下载并安装桌面版应用',
									icon: Rocket,
									color: 'from-purple-500 to-pink-500',
								},
								{
									step: '2',
									title: '注册账号',
									desc: '创建您的个人账户',
									icon: Shield,
									color: 'from-blue-500 to-cyan-500',
								},
								{
									step: '3',
									title: '选择功能',
									desc: '根据需求选择AI工具',
									icon: Globe,
									color: 'from-green-500 to-emerald-500',
								},
								{
									step: '4',
									title: '开始使用',
									desc: '享受智能助手服务',
									icon: Zap,
									color: 'from-orange-500 to-yellow-500',
								},
							].map((item, idx) => (
								<motion.div
									key={item.step}
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: 0.4 + idx * 0.1 }}
									whileHover={{ scale: 1.02 }}
									className="relative flex items-center p-5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer group"
								>
									<div
										className={`w-12 h-12 rounded-xl bg-linear-to-br ${item.color} flex items-center justify-center mr-5 shadow-lg group-hover:shadow-xl`}
									>
										<span className="text-white text-lg font-bold">
											{item.step}
										</span>
									</div>
									<div className="flex-1">
										<h4 className="font-semibold text-white mb-1 group-hover:text-purple-300 transition-colors">
											{item.title}
										</h4>
										<p className="text-sm text-gray-400">{item.desc}</p>
									</div>
									<motion.div
										className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10"
										whileHover={{ x: 5 }}
									>
										<ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-purple-400" />
									</motion.div>
								</motion.div>
							))}
						</div>
					</motion.div>

					{/* Testimonials */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.9 }}
						className="relative rounded-2xl p-8 border border-white/10 bg-linear-to-br from-white/5 to-white/0 backdrop-blur-xl overflow-hidden"
					>
						<div className="absolute -top-10 -right-10 w-40 h-40 bg-linear-to-br from-blue-500/10 to-transparent rounded-full blur-3xl" />
						<h3 className="text-xl font-semibold mb-8 text-white relative z-10">
							用户评价
						</h3>
						<div className="space-y-4">
							{[
								{
									name: '张明',
									comment: '这款AI助手极大地提升了我的工作效率！',
									role: '软件工程师',
									color: 'from-yellow-400 to-orange-400',
								},
								{
									name: '李娜',
									comment: '代码生成功能非常实用，节省了大量时间。',
									role: '前端开发',
									color: 'from-orange-400 to-pink-400',
								},
								{
									name: '王涛',
									comment: '文档处理功能让我的工作变得轻松多了。',
									role: '产品经理',
									color: 'from-green-400 to-cyan-400',
								},
							].map((user, idx) => (
								<motion.div
									key={idx}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 1 + idx * 0.1 }}
									whileHover={{ scale: 1.01 }}
									className="relative p-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer group"
								>
									<div className="flex items-start gap-4">
										<motion.div
											initial={{ scale: 0 }}
											animate={{ scale: 1 }}
											transition={{ delay: 1.1 + idx * 0.1 }}
											className="relative shrink-0"
										>
											<div
												className={`absolute -top-1 -left-1 w-16 h-16 rounded-2xl bg-linear-to-br ${user.color} flex items-center justify-center shadow-lg`}
											>
												<span className="text-white text-xl font-bold">
													{user.name.charAt(0)}
												</span>
											</div>
											<div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-lg bg-linear-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
												<Shield className="w-4 h-4 text-white" />
											</div>
										</motion.div>
										<div className="flex-1">
											<p className="text-gray-300 italic mb-3 leading-relaxed">
												"{user.comment}"
											</p>
											<div className="flex items-center">
												<p className="text-sm font-medium text-white">
													{user.name}
												</p>
												<span className="mx-2 text-gray-600">·</span>
												<p className="text-sm text-gray-400">{user.role}</p>
											</div>
										</div>
									</div>
								</motion.div>
							))}
						</div>
					</motion.div>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Home;
