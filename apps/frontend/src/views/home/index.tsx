import { ScrollArea } from '@ui/scroll-area';
import { motion } from 'framer-motion';
import { ArrowRight, SquareArrowOutUpRight } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FocusCarousel } from '@/components/design/FocusCarousel';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { onListen, openExternalUrl } from '@/utils';
import { getDesktopDownloadAbsoluteUrl } from '@/views/desktopDownload/paths';
import { getPluginDevGuideAbsoluteUrl } from '@/views/pluginDevGuide/paths';
import {
	createFeatures,
	createHeroSlides,
	createQuicklinks,
	createShowcase,
	createSteps,
	HUE_STYLES,
} from './content';
import { StageCard } from './StageCard';

const Home = () => {
	const navigate = useNavigate();
	const { t, locale } = useI18n();

	const SHOWCASE = useMemo(() => createShowcase(t), [t]);
	const STEPS = useMemo(() => createSteps(t), [t, locale]);
	const FEATURES = useMemo(() => createFeatures(navigate, t), [navigate, t]);
	const QUICKLINKS = useMemo(() => createQuicklinks(t), [t]);

	const rootRef = useRef<HTMLDivElement>(null);
	const [stageH, setStageH] = useState<number | undefined>(undefined);

	useLayoutEffect(() => {
		const el = rootRef.current;
		if (!el) return;
		const sync = () => setStageH(el.clientHeight);
		sync();
		const ro = new ResizeObserver(sync);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

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

	const onQuickStart = () => navigate('/knowledge');

	const HERO_SLIDES = useMemo(
		() =>
			createHeroSlides({
				t,
				locale,
				navigate,
				onQuickStart,
			}),
		// ponytail: 与原先一致，故意不把 navigate / onQuickStart 列入 deps
		[t, locale],
	);

	const stageEntries = useMemo(
		() =>
			FEATURES.map((f) => ({
				id: f.title,
				title: f.title,
				subtitle: f.subtitle,
				onClick: f.onClick,
			})),
		[FEATURES],
	);

	return (
		<div
			ref={rootRef}
			className="relative h-full min-h-0 w-full overflow-hidden rounded-b-md"
		>
			<ScrollArea className="relative z-1 h-full w-full rounded-b-md">
				<div className="relative min-h-full w-full">
					{/* 首屏：顶栏品牌条 → 全宽焦点轮播 → 底栏入口 */}
					<section
						className="box-border flex w-full flex-col px-5.5 pb-5.5"
						style={
							stageH != null
								? { height: stageH, minHeight: stageH }
								: { minHeight: '100%' }
						}
					>
						<StageCard
							brand="dnhyxc ai"
							headline={t('home.stage.headline')}
							status={t('home.stage.status')}
							entries={stageEntries}
							entriesAriaLabel={t('home.sections.showcase')}
							watermark="DNHYXC"
						>
							<FocusCarousel
								slides={HERO_SLIDES}
								leftHint={t('home.stage.services')}
								style={{ touchAction: 'pan-y' }}
								className="relative z-10 flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-7 py-8 md:px-12 md:py-10 lg:px-16"
								renderSlide={(s) => {
									const hue = HUE_STYLES[s.hue] ?? HUE_STYLES.teal;
									return (
										<>
											<p className="mb-3 text-sm tracking-[0.18em] text-textcolor/40">
												<span className="tabular-nums">{s.number}</span>
												<span className="mx-2 text-textcolor/40">·</span>
												{s.badge}
											</p>

											<h2 className="min-w-0 text-[clamp(1.4rem,2.8vw,2.25rem)] font-bold leading-snug tracking-tight text-textcolor">
												<span
													className={cn(
														'bg-linear-to-r bg-clip-text text-transparent',
														hue.icon,
													)}
												>
													{s.titleMain}
												</span>
												<span className="mx-2 font-light text-textcolor/25">
													·
												</span>
												<span className="font-semibold text-textcolor/90">
													{s.titleAccent}
												</span>
											</h2>

											<p className="mt-4 max-w-2xl text-pretty text-sm leading-7 text-textcolor/52 md:text-[0.95rem] md:leading-7">
												{s.subtitle}
											</p>

											<div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
												{s.cta.map((c, ci) => (
													<button
														key={`${s.id}-cta-${ci}`}
														type="button"
														onClick={c.onClick}
														className={cn(
															'inline-flex shrink-0 cursor-pointer items-center gap-1.5 text-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/40',
															c.primary
																? 'font-semibold text-teal-500 hover:text-teal-400'
																: 'font-medium text-textcolor/50 hover:text-teal-400',
														)}
														style={{ touchAction: 'manipulation' }}
													>
														{c.label}
														<ArrowRight className="size-3.5" aria-hidden />
													</button>
												))}
											</div>
										</>
									);
								}}
							/>
						</StageCard>
					</section>

					{/* 下方内容 */}
					<div className="relative mx-auto w-full space-y-5.5 px-5.5 pb-5.5">
						<div
							id="home-showcase"
							className="relative scroll-mt-4 overflow-hidden rounded-md bg-theme-background/80 p-6 backdrop-blur-xl"
						>
							<motion.h3
								initial={{ opacity: 0, y: 16 }}
								whileInView={{ opacity: 1, y: 0 }}
								viewport={{ once: true, margin: '-40px' }}
								transition={{ duration: 0.35 }}
								className="mb-6 text-xl font-semibold text-textcolor"
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
										className="group relative cursor-pointer rounded-md border border-transparent bg-theme/10 p-5 text-center backdrop-blur-sm transition-all duration-300 hover:shadow-sm hover:shadow-teal-500/10"
									>
										<div
											className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-md bg-linear-to-br ${feature.color} shadow-lg group-hover:shadow-xl`}
										>
											<feature.icon className="h-6 w-6 text-white" />
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
							<h3 className="relative z-10 mb-6 text-xl font-semibold text-textcolor">
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
										className="group relative flex cursor-pointer items-center rounded-md border border-transparent bg-theme/10 p-5 backdrop-blur-sm transition-all duration-300 hover:border-theme/5 hover:shadow-sm hover:shadow-teal-500/10"
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
											className={`mr-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${item.color} shadow-md group-hover:shadow-lg md:mr-5`}
										>
											<span className="text-2xl font-bold text-white">
												{item.step}
											</span>
										</div>
										<div className="flex h-14 min-w-0 flex-1 flex-col justify-between">
											<h4 className="mb-1 font-semibold text-textcolor transition-colors">
												{item.title}
											</h4>
											<p className="text-sm text-textcolor/50">{item.desc}</p>
										</div>
										<motion.div
											className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-theme/10 transition-all duration-300 ease-out group-hover:bg-teal-500/10"
											whileHover={{ x: 5 }}
										>
											<SquareArrowOutUpRight className="h-4 w-4 text-textcolor/50 group-hover:text-teal-500" />
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
							<h3 className="relative z-10 mb-6 text-xl font-semibold text-textcolor">
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
										className="group relative flex cursor-pointer items-center rounded-md border border-transparent bg-theme/10 p-5 backdrop-blur-sm transition-all duration-300 hover:border-theme/5 hover:shadow-sm hover:shadow-teal-500/10"
										onClick={item.onClick}
									>
										<div
											className={`mr-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${item.color} shadow-md group-hover:shadow-lg md:mr-5`}
										>
											<span className="text-2xl font-bold text-white">
												{item.index}
											</span>
										</div>
										<div className="flex h-14 min-w-0 flex-1 flex-col justify-between">
											<h4 className="mb-1 font-semibold text-textcolor transition-colors">
												{item.title}
											</h4>
											<p className="text-sm text-textcolor/50">{item.desc}</p>
										</div>
										<motion.div
											className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-theme/10 transition-all duration-300 ease-out group-hover:bg-teal-500/10"
											whileHover={{ x: 5 }}
										>
											<SquareArrowOutUpRight className="h-4 w-4 text-textcolor/50 group-hover:text-teal-500" />
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
