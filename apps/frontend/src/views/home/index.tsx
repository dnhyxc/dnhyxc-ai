import { Button } from '@ui/index';
import { ScrollArea } from '@ui/scroll-area';
import { motion } from 'framer-motion';
import {
	ChevronLeft,
	ChevronRight,
	Code2,
	FileText,
	Flower,
	Globe,
	LibraryBig,
	MessageSquare,
	NotebookTabs,
	Puzzle,
	Rocket,
	Shield,
	Sparkles,
	SquareArrowOutUpRight,
	Vegan,
	Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/hooks';
import { onListen, openExternalUrl } from '@/utils';
import { getDesktopDownloadAbsoluteUrl } from '@/views/desktopDownload/paths';
import { getPluginDevGuideAbsoluteUrl } from '@/views/pluginDevGuide/paths';
import { getProjectGuideAbsoluteUrl } from '@/views/projectGuide/paths';

/** 每張 slide 的色系映射，避免在 JSX 中重複長漸變 class 字串 */
const HUE_STYLES: Record<
	string,
	{ rail: string; icon: string; btn: string; glow: string }
> = {
	teal: {
		rail: 'bg-teal-400',
		icon: 'from-teal-400 to-[#14b8a6] shadow-teal-500/25',
		btn: 'from-teal-600 to-teal-300 hover:shadow-teal-500/30',
		glow: 'from-teal-600/15 via-cyan-500/8',
	},
	emerald: {
		rail: 'bg-emerald-400',
		icon: 'from-emerald-400 to-[#14b8a6] shadow-emerald-500/25',
		btn: 'from-emerald-400 to-[#14b8a6] hover:shadow-emerald-500/30',
		glow: 'from-emerald-500/15 via-teal-500/8',
	},
	amber: {
		rail: 'bg-amber-400',
		icon: 'from-amber-400 to-orange-500 shadow-amber-500/20',
		btn: 'from-amber-400 to-orange-500 hover:shadow-amber-500/30',
		glow: 'from-amber-500/15 via-orange-500/8',
	},
	rose: {
		rail: 'bg-rose-400',
		icon: 'from-rose-400 to-amber-600 shadow-rose-500/20',
		btn: 'from-rose-400 to-amber-600 hover:shadow-rose-500/30',
		glow: 'from-rose-500/15 via-amber-500/8',
	},
	violet: {
		rail: 'bg-violet-400',
		icon: 'from-violet-400 to-purple-600 shadow-violet-500/25',
		btn: 'from-violet-400 to-purple-600 hover:shadow-violet-500/30',
		glow: 'from-violet-500/15 via-purple-500/8',
	},
};

const Home = () => {
	const navigate = useNavigate();
	const { t, locale } = useI18n();

	const SHOWCASE = useMemo(
		() => [
			{
				icon: Puzzle,
				title: t('home.showcase.plugin.title'),
				desc: t('home.showcase.plugin.desc'),
				color: 'from-violet-400 to-purple-500',
			},
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
				/* 固定原版 teal hex，不跟随全局主题色 */
				color: 'from-[#14b8a6] to-cyan-600',
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
				step: '3',
				title: t('home.steps.start.title'),
				desc: t('home.steps.start.desc'),
				icon: Zap,
				color: 'from-orange-500 to-amber-500',
				/** 点击后进入智能对话 */
				navigateChat: true,
			},
			{
				step: '4',
				title: t('home.steps.pluginDev.title'),
				desc: t('home.steps.pluginDev.desc'),
				icon: Puzzle,
				color: 'from-violet-500 to-purple-600',
				/** 在默认浏览器打开插件开发手册 */
				openPluginDevGuide: true,
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
				/* 固定原版 teal hex，不跟随全局主题色 */
				color: 'from-emerald-400 to-[#14b8a6]',
				glow: 'shadow-emerald-500/25',
				hoverBg:
					'group-hover:bg-linear-to-br group-hover:from-emerald-500/15 group-hover:to-[#0d9488]/5',
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

	const QUICKLINKS = useMemo(() => {
		return [
			{
				index: '1',
				icon: Rocket,
				title: t('home.quicklinks.dnhyxc-ai.title'),
				desc: t('home.quicklinks.dnhyxc-ai.desc'),
				color: 'from-lime-300 to-emerald-500',
				downloadDesktop: true,
				onClick: () => void openExternalUrl('https://dnhyxc.cn:9002'),
			},
			{
				index: '2',
				icon: Code2,
				title: t('home.quicklinks.blog.title'),
				desc: t('home.quicklinks.blog.desc'),
				color: 'from-indigo-300 to-blue-400',
				downloadDesktop: true,
				onClick: () => void openExternalUrl('https://dnhyxc.cn'),
			},
			{
				index: '3',
				icon: Code2,
				title: t('home.quicklinks.github.title'),
				desc: t('home.quicklinks.github.desc'),
				color: 'from-red-300 to-rose-400',
				downloadDesktop: true,
				onClick: () => void openExternalUrl('https://github.com/dnhyxc'),
			},
		];
	}, [t]);

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

	// ─────────────────── Hero 轮播：左侧 sidebar 功能页介绍 ───────────────────
	const HERO_SLIDES = useMemo(() => {
		return [
			{
				id: 'overview',
				badge: t('common.appTitle') ?? '智能工作台',
				number: '01',
				icon: Sparkles,
				titleMain: t('home.hero.welcome'),
				titleAccent: t('home.hero.product'),
				subtitle: t('home.hero.subtitle'),
				spotlightA: 'from-teal-500/25',
				spotlightB: 'via-cyan-400/15',
				spotlightC: 'to-amber-300/0',
				hue: 'teal',
				cta: [
					{
						label: t('home.hero.quickStart'),
						primary: true,
						onClick: onClickQuickStart,
					},
					{
						label: t('home.hero.learnMore'),
						primary: false,
						onClick: () =>
							void openExternalUrl(getProjectGuideAbsoluteUrl(locale)),
					},
				],
				tags: [
					t('home.hero.knowledge.title'),
					t('home.hero.ebook.title'),
					t('home.hero.english.title'),
					t('home.hero.plugins.title'),
				],
			},
			{
				id: 'knowledge',
				badge: t('home.hero.knowledge.subtitle'),
				number: '02',
				icon: NotebookTabs,
				titleMain: t('home.hero.knowledge.title'),
				titleAccent: t('home.hero.knowledge.subtitle'),
				subtitle: t('home.hero.knowledge.desc'),
				spotlightA: 'from-emerald-500/25',
				spotlightB: 'via-teal-400/18',
				spotlightC: 'to-cyan-300/0',
				hue: 'emerald',
				cta: [
					{
						label: t('home.features.enter'),
						primary: true,
						onClick: () => navigate('/knowledge'),
					},
				],
				tags: [],
			},
			{
				id: 'ebook',
				badge: t('home.hero.ebook.subtitle'),
				number: '03',
				icon: LibraryBig,
				titleMain: t('home.hero.ebook.title'),
				titleAccent: t('home.hero.ebook.subtitle'),
				subtitle: t('home.hero.ebook.desc'),
				spotlightA: 'from-amber-500/25',
				spotlightB: 'via-orange-400/18',
				spotlightC: 'to-yellow-300/0',
				hue: 'amber',
				cta: [
					{
						label: t('home.features.enter'),
						primary: true,
						onClick: () => navigate('/ebook'),
					},
				],
				tags: [],
			},
			{
				id: 'english',
				badge: t('home.hero.english.subtitle'),
				number: '04',
				icon: Vegan,
				titleMain: t('home.hero.english.title'),
				titleAccent: t('home.hero.english.subtitle'),
				subtitle: t('home.hero.english.desc'),
				spotlightA: 'from-rose-500/22',
				spotlightB: 'via-amber-400/16',
				spotlightC: 'to-pink-300/0',
				hue: 'rose',
				cta: [
					{
						label: t('home.features.enter'),
						primary: true,
						onClick: () => navigate('/english-learning'),
					},
				],
				tags: [],
			},
			{
				id: 'plugins',
				badge: t('home.hero.plugins.subtitle'),
				number: '05',
				icon: Flower,
				titleMain: t('home.hero.plugins.title'),
				titleAccent: t('home.hero.plugins.subtitle'),
				subtitle: t('home.hero.plugins.desc'),
				spotlightA: 'from-violet-500/25',
				spotlightB: 'via-purple-400/18',
				spotlightC: 'to-indigo-300/0',
				hue: 'violet',
				cta: [
					{
						label: t('home.features.enter'),
						primary: true,
						onClick: () => navigate('/plugins'),
					},
					{
						label: t('home.steps.pluginDev.title'),
						primary: false,
						onClick: () =>
							void openExternalUrl(getPluginDevGuideAbsoluteUrl(locale)),
					},
				],
				tags: [],
			},
		] as const;
	}, [t, locale]);

	const [heroIndex, setHeroIndex] = useState(0);
	const heroTimerRef = useRef<number | null>(null);
	const heroHoverRef = useRef<boolean>(false);
	const HERO_AUTOPLAY_MS = 5200;

	const resetHeroTimer = () => {
		if (heroTimerRef.current != null) {
			window.clearTimeout(heroTimerRef.current);
		}
		heroTimerRef.current = window.setTimeout(tick, HERO_AUTOPLAY_MS);
	};

	const goHero = (delta: number) => {
		setHeroIndex((prev) => {
			const total = HERO_SLIDES.length;
			return (((prev + delta) % total) + total) % total;
		});
		resetHeroTimer();
	};
	const setHero = (idx: number) => {
		setHeroIndex(idx);
		resetHeroTimer();
	};

	const tick = () => {
		if (!heroHoverRef.current) {
			setHeroIndex((prev) => {
				const total = HERO_SLIDES.length;
				return (((prev + 1) % total) + total) % total;
			});
		}
		if (heroTimerRef.current != null) {
			window.clearTimeout(heroTimerRef.current);
		}
		heroTimerRef.current = window.setTimeout(tick, HERO_AUTOPLAY_MS);
	};

	useEffect(() => {
		heroTimerRef.current = window.setTimeout(tick, HERO_AUTOPLAY_MS);
		return () => {
			if (heroTimerRef.current != null) {
				window.clearTimeout(heroTimerRef.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [HERO_SLIDES.length]);

	return (
		<div className="relative h-full min-h-0 w-full overflow-hidden rounded-b-md">
			<ScrollArea className="relative z-1 h-full w-full rounded-b-md">
				<div className="relative min-h-full w-full">
					{/* 首屏：单一「欢迎」容器，内含标题区 + 三大入口，占满 Outlet 可视高度 */}
					<section className="mx-auto w-full px-5.5">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
							className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-md bg-linear-to-b from-theme-white/[0.07] to-theme-white/2 backdrop-blur-xl"
							style={{
								fontFamily: '"Noto Sans SC", system-ui, sans-serif',
							}}
						>
							{/* 顶栏：品牌 + 主文案 + 操作（与入口同属一个欢迎模块） */}
							<header className="relative z-10 shrink-0 pb-4.5 pt-4 md:px-6 md:pt-6 bg-theme-background/80 border-b border-theme/3 overflow-hidden">
								<div className="relative z-10 flex flex-col gap-3 mb-1">
									{/* Row 1：品牌徽標（左） + 控制按鈕（右） —— 左右邊界對齊 */}
									<div className="flex items-center justify-between mb-2.5">
										<motion.div
											initial={{ opacity: 0, x: -12 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: 0.08, duration: 0.4 }}
											className="inline-flex h-10 items-center gap-2.5 rounded-md border border-teal-400/5 bg-teal-500/10 px-4 backdrop-blur-sm"
										>
											<Sparkles
												className="h-[18px] w-[18px] text-teal-500"
												aria-hidden
											/>
											<span
												className="text-sm font-bold uppercase tracking-[0.16em] text-teal-300/90 sm:text-[15px]"
												style={{ fontFamily: '"Syne", sans-serif' }}
											>
												dnhyxc-ai
											</span>
										</motion.div>

										<div className="flex items-center gap-1.5">
											<Button
												onClick={() => goHero(-1)}
												aria-label="上一张"
												className="flex h-10 w-10 items-center justify-center rounded-md border border-teal-400/5 bg-teal-500/10 text-teal-300/80 backdrop-blur-sm transition-[border-color,background-color] duration-200 hover:border-teal-400/10 hover:bg-teal-500/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:outline-none"
												style={{ touchAction: 'manipulation' }}
											>
												<ChevronLeft
													className="h-4 w-4"
													strokeWidth={2.2}
													aria-hidden
												/>
											</Button>
											<Button
												onClick={() => goHero(1)}
												aria-label="下一张"
												className="flex h-10 w-10 items-center justify-center rounded-md border border-teal-400/5 bg-teal-500/10 text-teal-300/80 backdrop-blur-sm transition-[border-color,background-color] duration-200 hover:border-teal-400/10 hover:bg-teal-500/20 active:scale-95 focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:outline-none"
												style={{ touchAction: 'manipulation' }}
											>
												<ChevronRight
													className="h-4 w-4"
													strokeWidth={2.2}
													aria-hidden
												/>
											</Button>
										</div>
									</div>

									{/* Row 2：輪播主體 —— 固定高度 + 剛性 4 行 grid + 左 rail，所有元素 y 座標永遠不變 */}
									<div
										className="relative"
										onMouseEnter={() => {
											heroHoverRef.current = true;
										}}
										onMouseLeave={() => {
											heroHoverRef.current = false;
										}}
									>
										<div className="relative h-47 w-full">
											{HERO_SLIDES.map((s, i) => {
												const Icon = s.icon;
												const isActive = i === heroIndex;
												const direction = heroIndex > i ? -1 : 1;
												const hue = HUE_STYLES[s.hue] ?? HUE_STYLES.teal;
												return (
													<motion.div
														key={`slide-${s.id}`}
														initial={false}
														animate={{
															opacity: isActive ? 1 : 0,
															x: isActive ? 0 : 44 * direction,
														}}
														transition={{
															duration: 0.5,
															ease: [0.22, 1, 0.36, 1],
														}}
														className={`absolute inset-0 ${
															isActive
																? 'pointer-events-auto'
																: 'pointer-events-none'
														}`}
													>
														{/* 3 行弹性布局：顶部图标+标题 / 中部描述占满 / 底部 CTA+计数 */}
														<div className="flex h-full flex-col">
															{/* Row 1：图标 + 标题 —— 顶部对齐，标题铺满剩余宽度 */}
															<div className="flex shrink-0 items-center gap-3">
																<div
																	className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-linear-to-br shadow-lg ${hue.icon}`}
																>
																	<Icon
																		className="h-6 w-6 text-textcolor"
																		strokeWidth={2}
																		aria-hidden
																	/>
																</div>
																<h1
																	className="min-w-0 flex-1 text-balance font-extrabold leading-tight tracking-tight text-theme-white line-clamp-1 sm:text-[2.1rem] md:text-[2.35rem] lg:text-[2.5rem]"
																	style={{
																		fontFamily:
																			'"Syne", "Noto Sans SC", sans-serif',
																	}}
																>
																	{s.titleMain}
																	<span className="ml-1.5 bg-linear-to-r from-teal-300 via-cyan-400 to-amber-400 bg-clip-text text-transparent sm:ml-2">
																		{s.titleAccent}
																	</span>
																</h1>
															</div>

															{/* Row 2：描述 —— flex-1 占满中部空间，2 行截断 */}
															<div className="flex min-h-0 flex-1 items-center py-1.5">
																<p className="min-w-0 text-pretty text-xl font-medium leading-7 text-textcolor/60 line-clamp-2">
																	{s.subtitle}
																</p>
															</div>

															{/* Row 3：CTA 按钮（左） + 短横杠指示器（中） + 序号计数（右） —— 底部对齐，铺满宽度 */}
															<div className="relative flex shrink-0 items-center justify-between gap-3">
																<div className="flex items-center gap-2.5">
																	{s.cta.map((c, ci) => (
																		<button
																			key={`${s.id}-cta-${ci}`}
																			type="button"
																			onClick={c.onClick}
																			className={
																				c.primary
																					? `relative flex h-10 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md bg-linear-to-br px-5 text-sm font-semibold text-textcolor shadow-lg transition-[transform,box-shadow] duration-200 ease-out hover:scale-[1.03] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:outline-none ${hue.btn}`
																					: 'flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-theme/5 bg-theme-white/5 px-5 text-sm font-medium text-textcolor backdrop-blur-sm transition-[border-color,background-color] hover:border-theme/10 hover:bg-theme-white/10 focus-visible:ring-2 focus-visible:ring-teal-400/50 focus-visible:outline-none'
																			}
																			style={{
																				fontFamily:
																					'"Syne", "Noto Sans SC", sans-serif',
																				touchAction: 'manipulation',
																			}}
																		>
																			{c.label}
																			<SquareArrowOutUpRight
																				className="h-4 w-4 -mt-0.5"
																				aria-hidden
																			/>
																		</button>
																	))}
																</div>
																<div className="absolute right-0 -bottom-2 flex items-center gap-1.5">
																	{HERO_SLIDES.map((_it, idx) => {
																		const active = idx === heroIndex;
																		return (
																			<button
																				key={`pg-${s.id}-${idx}`}
																				type="button"
																				aria-label={`切换到第 ${idx + 1} 张`}
																				onClick={() => setHero(idx)}
																				className="group relative h-2 rounded-full cursor-pointer transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40"
																				style={{
																					width: active ? 20 : 8,
																					touchAction: 'manipulation',
																				}}
																			>
																				<span
																					className={`absolute inset-0 rounded-full transition-colors duration-300 ${
																						active
																							? 'bg-linear-to-r from-teal-400/50 to-cyan-400/40'
																							: 'bg-theme-white/10 group-hover:bg-theme-white/20'
																					}`}
																				/>
																			</button>
																		);
																	})}
																	<span
																		className="inline-flex h-7 shrink-0 items-center whitespace-nowrap pl-1 text-xs font-medium text-textcolor/35"
																		style={{
																			fontFamily: '"Syne", sans-serif',
																			fontVariantNumeric: 'tabular-nums',
																		}}
																	>
																		{s.number} /{' '}
																		{HERO_SLIDES.length
																			.toString()
																			.padStart(2, '0')}
																	</span>
																</div>
															</div>
														</div>
													</motion.div>
												);
											})}
										</div>
									</div>
								</div>
							</header>

							{/* 三大入口：与欢迎同属一块，纵向吃满剩余高度 */}
							<div className="relative z-10 grid min-h-0 flex-1 auto-rows-fr grid-cols-1 p-3 md:grid-cols-3 md:divide-x md:divide-y-0 md:divide-theme/2 md:p-0">
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
											className={`relative mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-linear-to-br ${feature.color} shadow-lg ${feature.glow} sm:h-14 sm:w-14`}
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

										<div className="relative mt-4 flex items-center justify-between gap-2 border-t border-dashed border-theme/5 pt-4 text-sm font-semibold text-teal-500/85 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-teal-500">
											<span>{t('home.features.enter')}</span>
											<SquareArrowOutUpRight className="h-4 w-4" />
										</div>
									</motion.div>
								))}
							</div>
						</motion.div>
					</section>

					{/* 下方内容在 ScrollArea 内滚动 */}
					<div className="relative mx-auto w-full space-y-5.5 px-5.5 py-5.5">
						<div className="relative overflow-hidden rounded-md bg-theme-background/80 p-6 backdrop-blur-xl">
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
							<div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-5">
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
							className="relative overflow-hidden rounded-md bg-theme-background/80 p-6 backdrop-blur-xl"
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
											} else if (item.openPluginDevGuide) {
												void openExternalUrl(
													getPluginDevGuideAbsoluteUrl(locale),
												);
											}
										}}
									>
										<div
											className={`mr-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${item.color} shadow-lg group-hover:shadow-xl md:mr-5`}
										>
											<span className="text-lg font-bold text-textcolor">
												{item.step}
											</span>
										</div>
										<div className="min-w-0 flex-1 h-14 flex flex-col justify-between">
											<h4 className="mb-1 font-semibold text-textcolor transition-colors group-hover:text-teal-500">
												{item.title}
											</h4>
											<p className="text-sm text-textcolor/50">{item.desc}</p>
										</div>
										<motion.div
											className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-theme-white/5 group-hover:bg-theme-white/10"
											whileHover={{ x: 4 }}
										>
											<SquareArrowOutUpRight className="h-4 w-4 text-textcolor/40 group-hover:text-teal-500" />
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
							className="relative overflow-hidden rounded-md bg-theme-background/80 p-6 backdrop-blur-xl"
						>
							<div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-linear-to-br from-teal-500/12 to-transparent blur-3xl" />
							<h3
								className="relative z-10 mb-6 text-xl font-semibold text-textcolor"
								style={{ fontFamily: '"Syne", "Noto Sans SC", sans-serif' }}
							>
								{t('home.sections.quicklinks')}
							</h3>
							<div className="space-y-4">
								{QUICKLINKS.map((item, idx) => (
									<motion.div
										key={item.index}
										initial={{ opacity: 0, x: -12 }}
										whileInView={{ opacity: 1, x: 0 }}
										viewport={{ once: true }}
										transition={{ delay: idx * 0.06, duration: 0.35 }}
										whileHover={{ scale: 1.01 }}
										className="group relative flex cursor-pointer items-center rounded-md border border-transparent bg-theme-white/5 p-5 backdrop-blur-sm transition-all duration-300 hover:border-theme-white/12 hover:bg-theme-white/10 hover:shadow-lg hover:shadow-teal-500/10"
										onClick={item.onClick}
									>
										<div
											className={`mr-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${item.color} shadow-lg group-hover:shadow-xl md:mr-5`}
										>
											<span className="text-lg font-bold text-textcolor">
												{item.index}
											</span>
										</div>
										<div className="min-w-0 flex-1 h-14 flex flex-col justify-between">
											<h4 className="mb-1 font-semibold text-textcolor transition-colors group-hover:text-teal-500">
												{item.title}
											</h4>
											<p className="text-sm text-textcolor/50">{item.desc}</p>
										</div>
										<motion.div
											className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-theme-white/5 group-hover:bg-theme-white/10"
											whileHover={{ x: 4 }}
										>
											<SquareArrowOutUpRight className="h-4 w-4 text-textcolor/40 group-hover:text-teal-500" />
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
