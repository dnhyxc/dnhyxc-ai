import { Button } from '@ui/index';
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
import { useI18n } from '@/hooks';
import { onListen, openExternalUrl } from '@/utils';
import { getDesktopDownloadAbsoluteUrl } from '@/views/desktopDownload/paths';
import { getProjectGuideAbsoluteUrl } from '@/views/projectGuide/paths';

const Home = () => {
	const navigate = useNavigate();
	const { t, locale } = useI18n();

	const SHOWCASE = useMemo(
		() => [
			{
				icon: Rocket,
				title: t('home.showcase.fast.title'),
				desc: t('home.showcase.fast.desc'),
				color: 'from-orange-400 to-yellow-400',
			},
			{
				icon: Shield,
				title: t('home.showcase.privacy.title'),
				desc: t('home.showcase.privacy.desc'),
				color: 'from-yellow-400 to-orange-400',
			},
			{
				icon: Globe,
				title: t('home.showcase.i18n.title'),
				desc: t('home.showcase.i18n.desc'),
				color: 'from-green-400 to-cyan-400',
			},
			{
				icon: Zap,
				title: t('home.showcase.lightweight.title'),
				desc: t('home.showcase.lightweight.desc'),
				color: 'from-green-400 to-emerald-400',
			},
		],
		[t],
	);

	const STEPS = useMemo(
		() => [
			{
				step: '1',
				title: t('home.steps.install.title'),
				desc: t('home.steps.install.desc'),
				icon: Rocket,
				color: 'from-teal-500 to-cyan-600',
				/** 在默认浏览器打开桌面端下载落地页 */
				downloadDesktop: true,
			},
			{
				step: '2',
				title: t('home.steps.register.title'),
				desc: t('home.steps.register.desc'),
				icon: Shield,
				color: 'from-cyan-500 to-blue-500',
				/** 点击后进入登录页「账号注册」视图 */
				navigateRegister: true,
			},
			{
				step: '4',
				title: t('home.steps.start.title'),
				desc: t('home.steps.start.desc'),
				icon: Zap,
				color: 'from-orange-500 to-amber-500',
				/** 点击后进入智能对话 */
				navigateChat: true,
			},
		],
		[t, locale],
	);

	const FEATURES = useMemo(() => {
		return [
			{
				index: '01',
				icon: MessageSquare,
				title: t('home.features.chat.title'),
				subtitle: t('home.features.chat.subtitle'),
				desc: t('home.features.chat.desc'),
				color: 'from-emerald-400 to-teal-500',
				glow: 'shadow-emerald-500/25',
				hoverBg:
					'group-hover:bg-linear-to-br group-hover:from-emerald-500/15 group-hover:to-teal-600/5',
				onClick: () => navigate('/chat'),
			},
			{
				index: '02',
				icon: Code2,
				title: t('home.features.coding.title'),
				subtitle: t('home.features.coding.subtitle'),
				desc: t('home.features.coding.desc'),
				color: 'from-amber-400 to-orange-500',
				glow: 'shadow-amber-500/20',
				hoverBg:
					'group-hover:bg-linear-to-br group-hover:from-amber-500/12 group-hover:to-orange-600/5',
				onClick: () => navigate('/coding'),
			},
			{
				index: '03',
				icon: FileText,
				title: t('home.features.document.title'),
				subtitle: t('home.features.document.subtitle'),
				desc: t('home.features.document.desc'),
				color: 'from-rose-400 to-amber-600',
				glow: 'shadow-rose-500/20',
				hoverBg:
					'group-hover:bg-linear-to-br group-hover:from-rose-500/12 group-hover:to-amber-700/5',
				onClick: () => navigate('/document'),
			},
		];
	}, [navigate, t]);

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

	// 使用原生 button + CSS 过渡，避免 motion.button 的 whileTap 与路由卸载叠在同一帧造成卡顿
	const onClickQuickStart = () => {
		navigate('/knowledge');
	};

	return (
		<div className="relative h-full min-h-0 w-full overflow-hidden rounded-b-md">
			<ScrollArea className="relative z-1 h-full w-full rounded-b-md">
				<div className="relative min-h-full w-full">
					{/* 首屏：单一「欢迎」容器，内含标题区 + 三大入口，占满 Outlet 可视高度 */}
					<section className="mx-auto w-full max-w-6xl px-3 pb-2 sm:px-5">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
							className="relative flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden rounded-md bg-linear-to-b from-theme-white/[0.07] to-theme-white/2 backdrop-blur-xl"
							style={{
								fontFamily: '"Noto Sans SC", system-ui, sans-serif',
							}}
						>
							{/* 顶栏：品牌 + 主文案 + 操作（与入口同属一个欢迎模块） */}
							<header className="relative z-10 shrink-0 px-3 pb-4 pt-4 sm:px-2 sm:pb-5 sm:pt-5 md:px-6 md:pt-6 bg-theme-background/80 border-b border-theme/3">
								<div className="flex flex-col gap-5">
									<div className="min-w-0 flex-1">
										<motion.div
											initial={{ opacity: 0, x: -12 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: 0.08, duration: 0.4 }}
											className="inline-flex items-center gap-2 rounded-md border border-teal-400/5 bg-teal-500/10 px-3 py-2"
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
											{t('home.hero.welcome')}
											<span className="ml-3 bg-linear-to-r from-teal-300 via-cyan-400 to-amber-400 bg-clip-text text-transparent">
												{t('home.hero.product')}
											</span>
										</motion.h1>
										<motion.div
											initial={{ opacity: 0, y: 12 }}
											animate={{ opacity: 1, y: 0 }}
											transition={{ delay: 0.18, duration: 0.4 }}
											className="mt-[21px] text-pretty text-xl leading-relaxed text-textcolor/50"
										>
											{t('home.hero.subtitle')}
										</motion.div>
									</div>
									<motion.div
										initial={{ opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ delay: 0.22, duration: 0.4 }}
										className="flex shrink-0 flex-wrap items-center gap-3 sm:gap-3 mb-1.5"
									>
										<Button
											variant="dynamic"
											onClick={onClickQuickStart}
											className="relative h-10 w-30 cursor-pointer overflow-hidden rounded-md bg-linear-to-r from-teal-500 to-cyan-600 px-6 pt-3 text-sm font-semibold text-textcolor shadow-lg transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.03] hover:shadow-teal-500/30 active:scale-[0.98]"
											style={{
												fontFamily: '"Syne", "Noto Sans SC", sans-serif',
											}}
										>
											{t('home.hero.quickStart')}
											<ArrowRight className="h-4 w-4 mb-1" />
										</Button>
										<Button
											variant="dynamic"
											onClick={() => {
												void openExternalUrl(
													getProjectGuideAbsoluteUrl(locale),
												);
											}}
											className="h-10 w-30 rounded-md border border-theme/5 bg-theme-white/5 px-6 text-sm font-medium text-textcolor backdrop-blur-sm transition-colors hover:border-theme/10 hover:bg-theme-white/10"
										>
											{t('home.hero.learnMore')}
											<ArrowRight className="h-4 w-4" />
										</Button>
									</motion.div>
								</div>
							</header>

							{/* 三大入口：与欢迎同属一块，纵向吃满剩余高度 */}
							<div className="relative z-10 grid min-h-0 flex-1 auto-rows-fr grid-cols-1 p-3 sm:p-4 md:grid-cols-3 md:divide-x md:divide-y-0 md:divide-theme/2 md:p-0">
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
										// whileHover={{ y: -3 }}
										whileTap={{ scale: 0.99 }}
										onClick={feature.onClick}
										className={`group relative flex min-h-0 cursor-pointer flex-col overflow-hidden bg-theme-background/80 p-4 transition-colors duration-300 md:p-5 lg:p-6 ${feature.hoverBg}`}
									>
										<div
											className={`pointer-events-none absolute -right-6 -top-10 text-[5.5rem] font-extrabold leading-none text-theme-white/4 transition-colors duration-300 group-hover:text-theme-white/7 sm:text-[6.5rem]`}
											style={{ fontFamily: '"Syne", sans-serif' }}
											aria-hidden
										>
											{feature.index}
										</div>

										<div
											className={`relative mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-linear-to-br ${feature.color} shadow-lg ${feature.glow} sm:h-14 sm:w-14`}
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

										<div className="relative mt-4 flex items-center gap-2 border-t border-dashed border-theme/5 pt-4 text-sm font-semibold text-teal-400/85 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-teal-300">
											<span>{t('home.features.enter')}</span>
											<ArrowRight className="h-4 w-4" />
										</div>
									</motion.div>
								))}
							</div>
						</motion.div>
					</section>

					{/* 下方内容在 ScrollArea 内滚动 */}
					<div className="relative mx-auto w-full max-w-6xl space-y-5 px-3 pt-3 sm:px-5">
						<div className="relative overflow-hidden rounded-md bg-theme-background/80 p-6 backdrop-blur-xl ">
							<motion.h3
								initial={{ opacity: 0, y: 16 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: '-40px' }}
								transition={{ duration: 0.35 }}
								className="mb-6 bg-linear-to-r from-teal-400 via-cyan-400 to-amber-400 bg-clip-text text-2xl font-bold text-transparent"
								style={{ fontFamily: '"Syne", "Noto Sans SC", sans-serif' }}
							>
								{t('home.sections.showcase')}
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
										className="group relative cursor-pointer rounded-md border border-transparent bg-theme-white/5 p-5 text-center backdrop-blur-sm transition-all duration-300 hover:border-theme-white/15 hover:bg-theme-white/10"
									>
										<div
											className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-linear-to-br ${feature.color} shadow-lg group-hover:shadow-xl`}
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
							className="relative mb-5 overflow-hidden rounded-md bg-theme-background/80 p-6 backdrop-blur-xl"
						>
							<div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-linear-to-br from-teal-500/12 to-transparent blur-3xl" />
							<h3
								className="relative z-10 mb-6 text-xl font-semibold text-textcolor"
								style={{ fontFamily: '"Syne", "Noto Sans SC", sans-serif' }}
							>
								{t('home.sections.steps')}
							</h3>
							<div className="space-y-4">
								{STEPS.map((item, idx) => (
									<motion.div
										key={item.step}
										initial={{ opacity: 0, x: -12 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={{ delay: idx * 0.06, duration: 0.35 }}
										whileHover={{ scale: 1.01 }}
										className="group relative flex cursor-pointer items-center rounded-md border border-transparent bg-theme-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-theme-white/12 hover:bg-theme-white/10 hover:shadow-lg hover:shadow-teal-500/10"
										onClick={() => {
											if (item.downloadDesktop) {
												void openExternalUrl(
													getDesktopDownloadAbsoluteUrl(locale),
												);
											} else if (item.navigateRegister) {
												navigate('/login?mode=register');
											} else if (item.navigateChat) {
												navigate('/chat');
											}
										}}
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
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Home;
