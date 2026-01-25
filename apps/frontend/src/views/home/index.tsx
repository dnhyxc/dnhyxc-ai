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
	Zap,
} from 'lucide-react';
import { useEffect } from 'react';
import { onListen } from '@/utils';

const Home = () => {
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

	return (
		<div className="w-full h-full flex flex-col justify-center items-center rounded-md relative overflow-hidden">
			<ScrollArea className="overflow-y-auto p-2.5 pt-0 h-full backdrop-blur-sm rounded-2xl">
				<div className="max-w-6xl mx-auto p-6">
					{/* Hero Section */}
					<motion.div
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.1 }}
						className="relative rounded-3xl p-10 border border-orange-500/20 bg-linear-to-br from-orange-500/5 to-yellow-500/5 backdrop-blur-xl mb-8 overflow-hidden"
					>
						<div className="absolute inset-0 bg-linear-to-r from-orange-500/10 via-yellow-500/10 to-amber-500/10 animate-gradient-x" />
						<div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
							<div className="flex-1 text-center md:text-left">
								<motion.h2
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.2 }}
									className="text-4xl md:text-5xl font-bold bg-linear-to-r from-orange-600 via-yellow-600 to-amber-600 bg-clip-text text-transparent mb-4"
								>
									欢迎使用 AI 智能助手
								</motion.h2>
								<motion.p
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className="text-xl text-gray-600 mb-6"
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
										className="px-8 py-3 bg-linear-to-r from-orange-500 to-yellow-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-orange-500/25 transition-all duration-300 cursor-pointer"
										whileHover={{ scale: 1.05, y: -2 }}
										whileTap={{ scale: 0.95, y: 0 }}
									>
										立即开始
										<ArrowRight className="inline-block ml-2 w-5 h-5" />
									</motion.button>
									<motion.button
										className="px-8 py-3 bg-white/50 backdrop-blur-sm border border-orange-500/30 text-gray-700 rounded-xl font-medium hover:bg-white/70 hover:border-orange-500/50 transition-all duration-300 cursor-pointer"
										whileHover={{ scale: 1.05, y: -2 }}
										whileTap={{ scale: 0.95, y: 0 }}
									>
										了解更多
									</motion.button>
								</motion.div>
							</div>
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.2 }}
								className="relative"
							>
								<div className="w-40 h-40 rounded-3xl bg-linear-to-br from-orange-500/20 via-yellow-500/20 to-amber-500/20 backdrop-blur-xl border border-white/20 shadow-2xl">
									<div className="w-full h-full rounded-3xl bg-linear-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-xl">
										<Rocket className="w-20 h-20 text-white" />
									</div>
								</div>
								<div className="absolute -top-4 -right-4 w-20 h-20 rounded-2xl bg-linear-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-lg">
									<Zap className="w-10 h-10 text-white" />
								</div>
							</motion.div>
						</div>
					</motion.div>

					{/* Features Grid */}
					<motion.div
						initial={{ opacity: 0, y: -20 }}
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
								color: 'from-green-500 to-orange-500',
								bg: 'from-green-500/10 to-orange-500/10',
							},
							{
								icon: Code2,
								title: '代码助手',
								subtitle: '编程支持',
								desc: '智能代码生成、调试、优化和解释，支持多种编程语言，提升开发效率',
								color: 'from-orange-500 to-yellow-500',
								bg: 'from-orange-500/10 to-yellow-500/10',
							},
							{
								icon: FileText,
								title: '文档处理',
								subtitle: '智能分析',
								desc: '支持PDF、Word、Excel等多种格式的智能解析、总结和内容提取',
								color: 'from-yellow-500 to-amber-500',
								bg: 'from-yellow-500/10 to-amber-500/10',
							},
						].map((feature) => (
							<div
								key={feature.title}
								className="relative rounded-2xl p-6 border border-orange-500/20 bg-linear-to-br from-orange-50/50 to-green-50/50 backdrop-blur-xl hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-300 cursor-pointer"
							>
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.2 }}
									className="flex items-center justify-between mb-4"
								>
									<div>
										<h3 className="text-xl font-semibold text-gray-800">
											{feature.title}
										</h3>
										<p className="text-sm text-textcolor">{feature.subtitle}</p>
									</div>
									<div className="w-14 h-14 rounded-2xl bg-linear-to-br from-orange-500/10 to-yellow-500/10 backdrop-blur-sm flex items-center justify-center">
										<div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg">
											<feature.icon className="w-5 h-5 text-white" />
										</div>
									</div>
								</motion.div>
								<motion.p
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 }}
									className="text-gray-600 mb-4"
								>
									{feature.desc}
								</motion.p>
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.4 }}
									className="flex items-center text-sm text-gray-500"
								>
									<Zap className="w-4 h-4 text-yellow-500 mr-2" />
									<span>高效智能处理</span>
								</motion.div>
							</div>
						))}
					</motion.div>

					{/* Features Showcase */}
					<div className="relative rounded-3xl p-8 border border-orange-500/20 bg-linear-to-br from-orange-500/5 to-yellow-500/5 backdrop-blur-xl mb-8 overflow-hidden">
						<h3 className="text-2xl font-bold mb-6 text-center bg-linear-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
							特色功能
						</h3>
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							{[
								{
									icon: Rocket,
									title: '快速响应',
									desc: '毫秒级响应速度',
									color: 'from-orange-500 to-yellow-500',
								},
								{
									icon: Shield,
									title: '隐私保护',
									desc: '本地化处理',
									color: 'from-yellow-500 to-orange-500',
								},
								{
									icon: Globe,
									title: '多语言',
									desc: '全球用户支持',
									color: 'from-green-500 to-yellow-500',
								},
								{
									icon: Zap,
									title: '轻量高效',
									desc: '低资源占用',
									color: 'from-green-500 to-amber-500',
								},
							].map((feature, _idx) => (
								<div
									key={feature.title}
									className="relative rounded-xl p-4 text-center border border-orange-500/20 bg-linear-to-br from-orange-50/30 to-yellow-50/30 backdrop-blur-sm hover:border-orange-500/50 transition-all duration-300 cursor-pointer"
								>
									<div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-linear-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-sm flex items-center justify-center">
										<div className="w-8 h-8 rounded-xl bg-linear-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg">
											<feature.icon className="w-5 h-5 text-white" />
										</div>
									</div>
									<h4 className="font-medium text-gray-800">{feature.title}</h4>
									<p className="text-xs text-gray-500 mt-1">{feature.desc}</p>
								</div>
							))}
						</div>
					</div>

					{/* Quick Start */}
					<div className="relative rounded-2xl p-6 border border-orange-500/20 bg-linear-to-br from-orange-50/30 to-yellow-50/30 backdrop-blur-xl mb-8 overflow-hidden">
						<h3 className="text-xl font-semibold mb-4 text-gray-800">
							快速开始
						</h3>
						<div className="space-y-3">
							{[
								{
									step: '1',
									title: '安装应用',
									desc: '下载并安装桌面版应用',
									icon: Rocket,
								},
								{
									step: '2',
									title: '注册账号',
									desc: '创建您的个人账户',
									icon: Shield,
								},
								{
									step: '3',
									title: '选择功能',
									desc: '根据需求选择AI工具',
									icon: Globe,
								},
								{
									step: '4',
									title: '开始使用',
									desc: '享受智能助手服务',
									icon: Zap,
								},
							].map((item, idx) => (
								<motion.div
									key={item.step}
									className="relative flex items-center p-4 rounded-xl border border-orange-500/10 bg-white/30 backdrop-blur-sm hover:border-orange-500/30 transition-all duration-300 cursor-pointer"
									whileHover={{ scale: 1.01 }}
									transition={{ delay: 0.8 + idx * 0.1 }}
								>
									<div className="w-10 h-10 rounded-xl bg-linear-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-sm flex items-center justify-center mr-4">
										<div className="w-7 h-7 rounded-lg bg-linear-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg">
											<span className="text-white text-sm font-bold">
												{item.step}
											</span>
										</div>
									</div>
									<div className="flex-1">
										<h4 className="font-medium text-gray-800">{item.title}</h4>
										<p className="text-sm text-gray-500">{item.desc}</p>
									</div>
									<ArrowRight className="w-5 h-5 text-gray-400" />
								</motion.div>
							))}
						</div>
					</div>

					{/* Testimonials */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ delay: 0.9 }}
						className="relative rounded-2xl p-6 border border-orange-500/20 bg-linear-to-br from-yellow-50/30 to-orange-50/30 backdrop-blur-xl overflow-hidden"
					>
						<h3 className="text-xl font-semibold mb-4 text-gray-800">
							用户评价
						</h3>
						<div className="space-y-4">
							{[
								{
									name: '张明',
									comment: '这款AI助手极大地提升了我的工作效率！',
									role: '软件工程师',
									color: 'from-yellow-500 to-orange-500',
								},
								{
									name: '李娜',
									comment: '代码生成功能非常实用，节省了大量时间。',
									role: '前端开发',
									color: 'from-orange-500 to-yellow-500',
								},
								{
									name: '王涛',
									comment: '文档处理功能让我的工作变得轻松多了。',
									role: '产品经理',
									color: 'from-green-500 to-yellow-500',
								},
							].map((user, _idx) => (
								<motion.div
									key={_idx}
									className="relative p-4 rounded-xl border border-orange-500/10 bg-white/30 backdrop-blur-sm hover:border-orange-500/30 transition-all duration-300 cursor-pointer"
									whileHover={{ scale: 1.01 }}
									initial={{ opacity: 0, y: 10 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 1.0 + _idx * 0.1 }}
								>
									<div className="relative mb-3">
										<div className="absolute -top-3 -left-3 w-14 h-14 rounded-2xl bg-linear-to-br from-orange-500/20 to-yellow-500/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
											<div className="w-11 h-11 rounded-xl bg-linear-to-br from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg">
												<span className="text-white text-lg font-bold">
													{user.name.charAt(0)}
												</span>
											</div>
										</div>
										<div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-linear-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-lg">
											<Shield className="w-5 h-5 text-white" />
										</div>
									</div>
									<p className="text-gray-700 italic mb-2">"{user.comment}"</p>
									<div className="flex items-center">
										<p className="text-sm font-medium text-gray-800">
											{user.name}
										</p>
										<span className="mx-2 text-gray-300">·</span>
										<p className="text-sm text-gray-500">{user.role}</p>
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
