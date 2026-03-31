import { openUrl } from '@tauri-apps/plugin-opener';
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
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { onListen } from '@/utils';

const SHOWCASE = [
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
];

/** 噪点纹理（SVG data URL） */
const NOISE_BG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;

const Home = () => {
	const navigate = useNavigate();

	const FEATURES = useMemo(() => {
		return [
			{
				index: '01',
				icon: MessageSquare,
				title: '智能对话',
				subtitle: '自然语言处理',
				desc: '与 AI 助手自然对话，获取实时解答、创作建议与学习辅导',
				color: 'from-emerald-400 to-teal-500',
				glow: 'shadow-emerald-500/25',
				hoverBg:
					'group-hover:bg-linear-to-br group-hover:from-emerald-500/15 group-hover:to-teal-600/5',
				onClick: () => navigate('/chat'),
			},
			{
				index: '02',
				icon: Code2,
				title: '代码助手',
				subtitle: '编程支持',
				desc: '智能生成、调试与优化代码，多语言开发全流程提效',
				color: 'from-amber-400 to-orange-500',
				glow: 'shadow-amber-500/20',
				hoverBg:
					'group-hover:bg-linear-to-br group-hover:from-amber-500/12 group-hover:to-orange-600/5',
				onClick: () => navigate('/coding'),
			},
			{
				index: '03',
				icon: FileText,
				title: '文档处理',
				subtitle: '智能分析',
				desc: 'PDF、Word、Excel 等格式的解析、总结与内容提取',
				color: 'from-rose-400 to-amber-600',
				glow: 'shadow-rose-500/20',
				hoverBg:
					'group-hover:bg-linear-to-br group-hover:from-rose-500/12 group-hover:to-amber-700/5',
				onClick: () => navigate('/document'),
			},
		];
	}, [navigate]);

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
		<div className="relative h-full min-h-0 w-full overflow-hidden rounded-b-md">
			{/* 环境光：压低饱和度，避免与欢迎区抢戏 */}
			<div className="pointer-events-none absolute inset-0 z-0 opacity-40">
				<div className="absolute right-[8%] top-[12%] h-64 w-64 rounded-full bg-teal-500/15 blur-[100px]" />
				<div className="absolute bottom-[18%] left-[5%] h-72 w-72 rounded-full bg-amber-500/10 blur-[110px]" />
			</div>

			<ScrollArea className="relative z-1 h-full w-full rounded-b-md">
				<div className="relative min-h-full w-full">
					{/* 首屏：单一「欢迎」容器，内含标题区 + 三大入口，占满 Outlet 可视高度 */}
					<section className="relative box-border flex min-h-full w-full flex-col px-3 py-2 pt-0 sm:px-5 sm:py-3 sm:pt-0">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
							className="relative flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-2xl border border-theme-white/12 bg-linear-to-b from-theme-white/[0.07] to-theme-white/2 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] backdrop-blur-xl md:rounded-3xl"
							style={{
								fontFamily: '"Noto Sans SC", system-ui, sans-serif',
							}}
						>
							{/* 网格与光晕底纹 */}
							{/* <div
								className="pointer-events-none absolute inset-0 opacity-[0.35]"
								style={{
									backgroundImage: `
								linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
								linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
							`,
									backgroundSize: '48px 48px',
								}}
								aria-hidden
							/>
							<div
								className="pointer-events-none absolute -left-1/4 top-0 h-[120%] w-[70%] rotate-12 bg-linear-to-br from-teal-500/12 via-transparent to-transparent blur-3xl"
								aria-hidden
							/>
							<div
								className="pointer-events-none absolute -right-1/4 bottom-0 h-full w-[60%] -rotate-6 bg-linear-to-tl from-amber-500/10 via-transparent to-transparent blur-3xl"
								aria-hidden
							/> */}
							<div
								className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
								style={{ backgroundImage: NOISE_BG }}
								aria-hidden
							/>

							{/* 顶栏：品牌 + 主文案 + 操作（与入口同属一个欢迎模块） */}
							<header className="relative z-10 shrink-0 border-b border-theme-white/8 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5 md:px-8 md:pt-6">
								<div className="flex flex-col gap-5">
									<div className="min-w-0 flex-1">
										<motion.div
											initial={{ opacity: 0, x: -12 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: 0.08, duration: 0.4 }}
											className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-400/25 bg-teal-500/10 px-3 py-1.5"
										>
											<Sparkles className="h-4 w-4 text-teal-400" />
											<span
												className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300/90 sm:text-sm"
												style={{ fontFamily: '"Syne", sans-serif' }}
											>
												dnhyxc-ai
											</span>
										</motion.div>
										<motion.h1
											initial={{ opacity: 0, y: 14 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.12, duration: 0.45 }}
											className="mt-5 text-balance text-2xl font-extrabold leading-[1.1] tracking-tight text-theme-white sm:text-3xl md:text-4xl lg:text-[2.35rem]"
											style={{
												fontFamily: '"Syne", "Noto Sans SC", sans-serif',
											}}
										>
											欢迎使用
											<span className="ml-3 bg-linear-to-r from-teal-300 via-cyan-400 to-amber-400 bg-clip-text text-transparent">
												智能助手
											</span>
										</motion.h1>
										<motion.div
											initial={{ opacity: 0, y: 12 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.18, duration: 0.4 }}
											className="mt-6 mb-[11px] text-pretty text-xl leading-relaxed text-textcolor/75"
										>
											一款桌面端 AI
											工作台：对话、代码与文档能力集中在一处，按需进入对应模块即可开始。
										</motion.div>
									</div>
									<motion.div
										initial={{ opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.22, duration: 0.4 }}
										className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-3 mb-1.5"
									>
										<motion.button
											type="button"
											whileHover={{ scale: 1.03 }}
											whileTap={{ scale: 0.98 }}
											onClick={() => navigate('/chat')}
											className="relative h-11 overflow-hidden rounded-xl bg-linear-to-r from-teal-500 to-cyan-600 px-6 text-sm font-semibold text-textcolor shadow-lg transition-shadow hover:shadow-teal-500/30 sm:h-12 sm:px-7"
											style={{
												fontFamily: '"Syne", "Noto Sans SC", sans-serif',
											}}
										>
											<span className="relative z-10 flex items-center gap-2">
												快速开始
												<ArrowRight className="h-4 w-4" />
											</span>
										</motion.button>
										<button
											type="button"
											onClick={() => {
												openUrl('https://github.com/dnhyxc/dnhyxc-ai/wiki');
											}}
											className="h-11 rounded-xl border border-theme-white/15 bg-theme-white/5 px-6 text-sm font-medium text-textcolor backdrop-blur-sm transition-colors hover:border-theme-white/25 hover:bg-theme-white/10 sm:h-12 sm:px-7"
										>
											了解更多
										</button>
									</motion.div>
								</div>
							</header>

							{/* 三大入口：与欢迎同属一块，纵向吃满剩余高度 */}
							<div className="relative z-10 grid min-h-0 flex-1 auto-rows-fr grid-cols-1 divide-y divide-theme-white/10 p-3 sm:p-4 md:grid-cols-3 md:divide-x md:divide-y-0 md:divide-theme-white/10 md:p-0">
								{FEATURES.map((feature, tileIndex) => (
									<motion.div
										key={feature.title}
										role="button"
										tabIndex={0}
										initial={{ opacity: 0, y: 24 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{
											delay: 0.28 + tileIndex * 0.08,
											duration: 0.45,
											ease: [0.22, 1, 0.36, 1],
										}}
										whileHover={{ y: -3 }}
										whileTap={{ scale: 0.99 }}
										onClick={feature.onClick}
										onKeyDown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												feature.onClick();
											}
										}}
										className={`group relative flex min-h-0 cursor-pointer flex-col overflow-hidden bg-theme-white/4 p-4 transition-colors duration-300 md:p-5 lg:p-6 ${feature.hoverBg}`}
									>
										<div
											className={`pointer-events-none absolute -right-6 -top-10 text-[5.5rem] font-black leading-none text-theme-white/4 transition-colors duration-300 group-hover:text-theme-white/7 sm:text-[6.5rem]`}
											style={{ fontFamily: '"Syne", sans-serif' }}
											aria-hidden
										>
											{feature.index}
										</div>

										<div
											className={`relative mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br ${feature.color} shadow-lg ${feature.glow} sm:h-14 sm:w-14`}
										>
											<feature.icon
												className="h-6 w-6 text-textcolor"
												strokeWidth={2}
											/>
										</div>

										<h2
											className="relative text-lg font-bold text-theme-white sm:text-xl"
											style={{
												fontFamily: '"Syne", "Noto Sans SC", sans-serif',
											}}
										>
											{feature.title}
										</h2>
										<p className="relative mt-2 text-xs font-medium text-textcolor/45 sm:text-sm">
											{feature.subtitle}
										</p>
										<p className="relative mt-4 my-1 min-h-0 flex-1 text-sm leading-relaxed text-textcolor/65 line-clamp-4 sm:line-clamp-5">
											{feature.desc}
										</p>

										<div className="relative mt-4 flex items-center gap-2 border-t border-dashed border-theme-white/12 pt-4 text-sm font-semibold text-teal-400/85 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-teal-300">
											<span>进入模块</span>
											<ArrowRight className="h-4 w-4" />
										</div>
									</motion.div>
								))}
							</div>
						</motion.div>
					</section>

					{/* 下方内容在 ScrollArea 内滚动 */}
					<div className="relative mx-auto w-full max-w-6xl space-y-5 px-3 pb-8 pt-3 sm:px-5">
						<div className="relative overflow-hidden rounded-2xl border border-theme-white/8 bg-linear-to-br from-theme-white/5 to-theme-white/5 p-6 backdrop-blur-xl md:rounded-3xl">
							<motion.h3
								initial={{ opacity: 0, y: 16 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: '-40px' }}
								transition={{ duration: 0.35 }}
								className="mb-6 bg-linear-to-r from-teal-400 via-cyan-400 to-amber-400 bg-clip-text text-2xl font-bold text-transparent"
								style={{ fontFamily: '"Syne", "Noto Sans SC", sans-serif' }}
							>
								特色功能
							</motion.h3>
							<div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
								{SHOWCASE.map((feature, idx) => (
									<motion.div
										key={feature.title}
										initial={{ opacity: 0, y: 16 }}
										whileInView={{ opacity: 1, y: 0 }}
										viewport={{ once: true, margin: '-20px' }}
										transition={{ delay: idx * 0.05, duration: 0.35 }}
										whileHover={{ scale: 1.04, y: -2 }}
										className="group relative cursor-pointer rounded-2xl border border-transparent bg-theme-white/5 p-5 text-center backdrop-blur-sm transition-all duration-300 hover:border-theme-white/15 hover:bg-theme-white/10"
									>
										<div
											className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br ${feature.color} shadow-lg group-hover:shadow-xl`}
										>
											<feature.icon className="h-6 w-6 text-textcolor" />
										</div>
										<h4 className="mb-1 font-semibold text-textcolor transition-colors">
											{feature.title}
										</h4>
										<p className="text-xs text-textcolor/50 transition-colors">
											{feature.desc}
										</p>
									</motion.div>
								))}
							</div>
						</div>

						<motion.div
							initial={{ opacity: 0, y: 16 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-40px' }}
							transition={{ duration: 0.4 }}
							className="relative mb-5 overflow-hidden rounded-2xl border border-theme-white/8 bg-linear-to-br from-theme-white/5 to-theme-white/5 p-6 backdrop-blur-xl md:rounded-3xl"
						>
							<div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-linear-to-br from-teal-500/12 to-transparent blur-3xl" />
							<h3
								className="relative z-10 mb-6 text-xl font-semibold text-textcolor"
								style={{ fontFamily: '"Syne", "Noto Sans SC", sans-serif' }}
							>
								快速开始
							</h3>
							<div className="space-y-4">
								{[
									{
										step: '1',
										title: '安装应用',
										desc: '下载并安装桌面版应用',
										icon: Rocket,
										color: 'from-teal-500 to-cyan-500',
									},
									{
										step: '2',
										title: '注册账号',
										desc: '创建您的个人账户',
										icon: Shield,
										color: 'from-cyan-500 to-blue-500',
									},
									{
										step: '3',
										title: '选择功能',
										desc: '根据需求选择AI工具',
										icon: Globe,
										color: 'from-amber-500 to-orange-500',
									},
									{
										step: '4',
										title: '开始使用',
										desc: '享受智能助手服务',
										icon: Zap,
										color: 'from-orange-500 to-amber-500',
									},
								].map((item, idx) => (
									<motion.div
										key={item.step}
										initial={{ opacity: 0, x: -12 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={{ delay: idx * 0.06, duration: 0.35 }}
										whileHover={{ scale: 1.01 }}
										className="group relative flex cursor-pointer items-center rounded-2xl border border-transparent bg-theme-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-theme-white/12 hover:bg-theme-white/10 hover:shadow-lg hover:shadow-teal-500/10"
									>
										<div
											className={`mr-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${item.color} shadow-lg group-hover:shadow-xl md:mr-5`}
										>
											<span className="text-lg font-bold text-textcolor">
												{item.step}
											</span>
										</div>
										<div className="min-w-0 flex-1">
											<h4 className="mb-1 font-semibold text-textcolor transition-colors group-hover:text-teal-300">
												{item.title}
											</h4>
											<p className="text-sm text-textcolor/50">{item.desc}</p>
										</div>
										<motion.div
											className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-theme-white/5 group-hover:bg-theme-white/10"
											whileHover={{ x: 4 }}
										>
											<ArrowRight className="h-5 w-5 text-textcolor/40 group-hover:text-teal-400" />
										</motion.div>
									</motion.div>
								))}
							</div>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, y: 16 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true, margin: '-40px' }}
							transition={{ duration: 0.4 }}
							className="relative overflow-hidden rounded-2xl border border-theme-white/8 bg-linear-to-br from-theme-white/5 to-theme-white/5 p-6 backdrop-blur-xl md:rounded-3xl"
						>
							<div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-linear-to-br from-cyan-500/10 to-transparent blur-3xl" />
							<h3
								className="relative z-10 mb-6 text-xl font-semibold text-textcolor"
								style={{ fontFamily: '"Syne", "Noto Sans SC", sans-serif' }}
							>
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
										color: 'from-orange-400 to-amber-400',
									},
									{
										name: '王涛',
										comment: '文档处理功能让我的工作变得轻松多了。',
										role: '产品经理',
										color: 'from-emerald-400 to-teal-400',
									},
								].map((user, idx) => (
									<motion.div
										key={user.name}
										initial={{ opacity: 0, y: 10 }}
										whileInView={{ opacity: 1, y: 0 }}
										viewport={{ once: true }}
										transition={{ delay: idx * 0.06, duration: 0.35 }}
										whileHover={{ scale: 1.005 }}
										className="group relative cursor-pointer rounded-2xl border border-transparent bg-theme-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:border-theme-white/12 hover:bg-theme-white/10 hover:shadow-lg hover:shadow-teal-500/10"
									>
										<div className="flex items-start gap-4">
											<div className="relative shrink-0">
												<div
													className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br ${user.color} shadow-lg md:h-16 md:w-16`}
												>
													<span className="text-xl font-bold text-textcolor">
														{user.name.charAt(0)}
													</span>
												</div>
												<div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-teal-500 to-cyan-600 shadow-lg">
													<Shield className="h-4 w-4 text-textcolor" />
												</div>
											</div>
											<div className="min-w-0 flex-1">
												<p className="mb-3 leading-relaxed text-textcolor/70 italic">
													"{user.comment}"
												</p>
												<div className="flex flex-wrap items-center gap-1 text-sm">
													<span className="font-medium text-textcolor">
														{user.name}
													</span>
													<span className="text-textcolor/60">·</span>
													<span className="text-textcolor/50">{user.role}</span>
												</div>
											</div>
										</div>
									</motion.div>
								))}
							</div>
						</motion.div>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Home;
