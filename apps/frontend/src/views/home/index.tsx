import { ScrollArea } from '@ui/scroll-area';
import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { onListen } from '@/utils';

const Home = () => {
	// 在组件中添加进度监听
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
			<ScrollArea className="overflow-y-auto p-2.5 pt-0 h-full backdrop-blur-sm rounded-2xl shadow-inner shadow-black/10">
				<motion.div
					initial={{ opacity: 0, y: -20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, delay: 0.1 }}
				>
					<motion.div
						initial={{ opacity: 0, y: -20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
					>
						{/* 欢迎卡片 */}
						<div className="md:col-span-2 lg:col-span-3 bg-gradient-to-r from-theme-color/10 to-theme-foreground/10 backdrop-blur-sm rounded-2xl p-8 border border-theme-border/50 shadow-xl">
							<div className="flex flex-col md:flex-row items-center gap-6">
								<div className="flex-1">
									<h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-theme-color to-theme-foreground bg-clip-text text-transparent mb-3">
										欢迎使用 AI 智能助手
									</h2>
									<p className="text-theme-foreground/80 mb-4">
										一款功能强大的智能桌面应用，集成了多种AI工具和实用功能，帮助您更高效地工作和学习。
									</p>
									<div className="flex flex-wrap gap-3">
										<motion.button
											className="px-6 py-2 bg-gradient-to-r from-theme-color to-theme-foreground text-white rounded-lg font-medium hover:shadow-lg hover:shadow-theme-color/30 transition-all"
											whileHover={{ scale: 1.05 }}
											whileTap={{ scale: 0.95 }}
										>
											立即开始
										</motion.button>
										<motion.button
											className="px-6 py-2 bg-theme-background border border-theme-border text-theme-foreground rounded-lg font-medium hover:bg-theme-muted transition-all"
											whileHover={{ scale: 1.05 }}
											whileTap={{ scale: 0.95 }}
										>
											了解更多
										</motion.button>
									</div>
								</div>
								<div className="w-32 h-32 rounded-full bg-gradient-to-br from-theme-color/20 to-blue-500/20 flex items-center justify-center">
									<div className="w-24 h-24 rounded-full bg-gradient-to-br from-theme-color to-blue-500 flex items-center justify-center">
										<span className="text-3xl text-white">🤖</span>
									</div>
								</div>
							</div>
						</div>

						{/* 核心功能卡片 1 */}
						<div className="bg-gradient-to-br from-theme-card to-theme-muted/80 backdrop-blur-sm rounded-2xl p-6 border border-theme-border/50 shadow-xl shadow-theme-color/5 hover:shadow-2xl hover:shadow-theme-color/10 transition-all duration-300">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-lg font-semibold text-theme-foreground">
										智能对话
									</h3>
									<p className="text-sm text-theme-foreground/60">
										自然语言处理
									</p>
								</div>
								<div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 flex items-center justify-center">
									<div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
										<span className="text-white text-sm">💬</span>
									</div>
								</div>
							</div>
							<p className="text-theme-foreground/80 mb-4">
								与AI助手进行自然对话，获取实时解答、创作建议、学习辅导等全方位支持。
							</p>
							<div className="flex items-center text-sm text-theme-foreground/60">
								<span className="text-green-500">✓</span>
								<span className="ml-2">支持多轮对话</span>
							</div>
						</div>

						{/* 核心功能卡片 2 */}
						<div className="bg-gradient-to-br from-theme-card to-theme-muted/80 backdrop-blur-sm rounded-2xl p-6 border border-theme-border/50 shadow-xl shadow-theme-color/5 hover:shadow-2xl hover:shadow-theme-color/10 transition-all duration-300">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-lg font-semibold text-theme-foreground">
										代码助手
									</h3>
									<p className="text-sm text-theme-foreground/60">编程支持</p>
								</div>
								<div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
									<div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
										<span className="text-white text-sm">💻</span>
									</div>
								</div>
							</div>
							<p className="text-theme-foreground/80 mb-4">
								智能代码生成、调试、优化和解释，支持多种编程语言，提升开发效率。
							</p>
							<div className="flex items-center text-sm text-theme-foreground/60">
								<span className="text-green-500">✓</span>
								<span className="ml-2">支持20+编程语言</span>
							</div>
						</div>

						{/* 核心功能卡片 3 */}
						<div className="bg-gradient-to-br from-theme-card to-theme-muted/80 backdrop-blur-sm rounded-2xl p-6 border border-theme-border/50 shadow-xl shadow-theme-color/5 hover:shadow-2xl hover:shadow-theme-color/10 transition-all duration-300">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-lg font-semibold text-theme-foreground">
										文档处理
									</h3>
									<p className="text-sm text-theme-foreground/60">智能分析</p>
								</div>
								<div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 flex items-center justify-center">
									<div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
										<span className="text-white text-sm">📄</span>
									</div>
								</div>
							</div>
							<p className="text-theme-foreground/80 mb-4">
								支持PDF、Word、Excel等多种格式的智能解析、总结和内容提取。
							</p>
							<div className="flex items-center text-sm text-theme-foreground/60">
								<span className="text-green-500">✓</span>
								<span className="ml-2">多格式支持</span>
							</div>
						</div>

						{/* 特色功能展示 */}
						<div className="md:col-span-2 lg:col-span-3 bg-gradient-to-r from-theme-card/80 to-theme-muted/60 backdrop-blur-sm rounded-2xl p-6 border border-theme-border/50 shadow-xl shadow-theme-color/5">
							<h3 className="text-xl font-bold mb-6 bg-gradient-to-r from-theme-color to-theme-foreground bg-clip-text text-transparent">
								特色功能
							</h3>
							<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
								{[
									{ icon: '🚀', title: '快速响应', desc: '毫秒级响应速度' },
									{ icon: '🔒', title: '隐私保护', desc: '本地化处理' },
									{ icon: '🌐', title: '多语言', desc: '全球用户支持' },
									{ icon: '⚡', title: '轻量高效', desc: '低资源占用' },
								].map((feature, idx) => (
									<motion.div
										key={feature.title}
										className="bg-theme-background/50 rounded-xl p-4 text-center border border-theme-border/30 hover:border-theme-color/50 transition-all duration-300 hover:scale-105"
										whileHover={{ scale: 1.05 }}
										initial={{ opacity: 0, y: 20 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.6 + idx * 0.1 }}
									>
										<div className="w-10 h-10 mx-auto mb-3 rounded-full bg-gradient-to-r from-theme-color/20 to-theme-foreground/20 flex items-center justify-center">
											<div className="w-6 h-6 rounded-full bg-gradient-to-r from-theme-color to-theme-foreground flex items-center justify-center">
												<span className="text-white text-xs">
													{feature.icon}
												</span>
											</div>
										</div>
										<h4 className="font-medium text-theme-foreground">
											{feature.title}
										</h4>
										<p className="text-xs text-theme-foreground/60 mt-1">
											{feature.desc}
										</p>
									</motion.div>
								))}
							</div>
						</div>

						{/* 使用指引 */}
						<div className="md:col-span-2 bg-gradient-to-br from-theme-card to-theme-muted/80 backdrop-blur-sm rounded-2xl p-6 border border-theme-border/50 shadow-xl">
							<h3 className="text-lg font-semibold mb-4 text-theme-foreground">
								快速开始
							</h3>
							<div className="space-y-4">
								{[
									{
										step: '1',
										title: '安装应用',
										desc: '下载并安装桌面版应用',
									},
									{ step: '2', title: '注册账号', desc: '创建您的个人账户' },
									{ step: '3', title: '选择功能', desc: '根据需求选择AI工具' },
									{ step: '4', title: '开始使用', desc: '享受智能助手服务' },
								].map((item) => (
									<div key={item.step} className="flex items-center">
										<div className="w-8 h-8 rounded-full bg-gradient-to-r from-theme-color/20 to-theme-foreground/20 flex items-center justify-center mr-3">
											<div className="w-6 h-6 rounded-full bg-gradient-to-r from-theme-color to-theme-foreground flex items-center justify-center">
												<span className="text-white text-xs">{item.step}</span>
											</div>
										</div>
										<div className="flex-1">
											<h4 className="font-medium text-theme-foreground">
												{item.title}
											</h4>
											<p className="text-sm text-theme-foreground/60">
												{item.desc}
											</p>
										</div>
									</div>
								))}
							</div>
						</div>

						{/* 用户评价 */}
						<div className="bg-gradient-to-br from-theme-card to-theme-muted/80 backdrop-blur-sm rounded-2xl p-6 border border-theme-border/50 shadow-xl">
							<h3 className="text-lg font-semibold mb-4 text-theme-foreground">
								用户评价
							</h3>
							<div className="space-y-4">
								{[
									{
										name: '张明',
										comment: '这款AI助手极大地提升了我的工作效率！',
										role: '软件工程师',
									},
									{
										name: '李娜',
										comment: '代码生成功能非常实用，节省了大量时间。',
										role: '前端开发',
									},
									{
										name: '王涛',
										comment: '文档处理功能让我的工作变得轻松多了。',
										role: '产品经理',
									},
								].map((user, idx) => (
									<div
										key={idx}
										className="bg-theme-background/30 rounded-lg p-4"
									>
										<p className="text-theme-foreground/80 italic mb-2">
											"{user.comment}"
										</p>
										<div className="flex items-center">
											<div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 flex items-center justify-center mr-2">
												<span className="text-blue-500 text-xs">
													{user.name.charAt(0)}
												</span>
											</div>
											<div>
												<p className="text-sm font-medium text-theme-foreground">
													{user.name}
												</p>
												<p className="text-xs text-theme-foreground/60">
													{user.role}
												</p>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					</motion.div>
				</motion.div>
			</ScrollArea>
		</div>
	);
};

export default Home;
