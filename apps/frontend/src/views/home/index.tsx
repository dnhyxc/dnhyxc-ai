import { ScrollArea } from '@ui/scroll-area';
import { ArrowRight } from 'lucide-react';
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
import { type HueKey, type ItemCardProps, SectionCards } from './SectionCards';
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

	const showcaseItems: ItemCardProps[] = useMemo(
		() =>
			SHOWCASE.map((feature) => ({
				itemKey: feature.title,
				hue: feature.hue as HueKey,
				icon: feature.icon,
				title: feature.title,
				desc: feature.desc,
				delay: 0,
			})),
		[SHOWCASE, t, navigate],
	);

	const stepItems: ItemCardProps[] = useMemo(
		() =>
			STEPS.map((item) => ({
				itemKey: item.step,
				hue: item.hue as HueKey,
				icon: item.icon,
				title: item.title,
				desc: item.desc,
				ctaLabel: t('home.features.enter'),
				delay: 0,
				onClick: () => {
					if (item.downloadDesktop) {
						void openExternalUrl(getDesktopDownloadAbsoluteUrl(locale));
					} else if (item.navigateRegister) {
						navigate('/login?mode=register');
					} else if (item.navigateChat) {
						navigate('/chat');
					} else if (item.openPluginDevGuide) {
						void openExternalUrl(getPluginDevGuideAbsoluteUrl(locale));
					}
				},
			})),
		[STEPS, t, locale, navigate],
	);

	const quicklinkItems: ItemCardProps[] = useMemo(
		() =>
			QUICKLINKS.map((item) => ({
				itemKey: item.index,
				hue: item.hue as HueKey,
				icon: item.icon,
				title: item.title,
				desc: item.desc,
				ctaLabel: t('home.hero.learnMore'),
				delay: 0,
				onClick: item.onClick,
			})),
		[QUICKLINKS, t],
	);

	return (
		<div
			ref={rootRef}
			className="relative h-full min-h-0 w-full overflow-hidden rounded-b-md"
		>
			<ScrollArea className="relative z-1 h-full w-full rounded-b-md">
				<div className="relative min-h-full w-full">
					{/* 首屏 */}
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
						<SectionCards
							id="home-showcase"
							title={t('home.sections.showcase')}
							items={showcaseItems}
							delayStep={0.05}
							status={t('home.sections.showcaseStatus')}
						/>
						<SectionCards
							title={t('home.sections.steps')}
							items={stepItems}
							status={t('home.sections.stepsStatus')}
						/>
						<SectionCards
							title={t('home.sections.quicklinks')}
							items={quicklinkItems}
							status={t('home.sections.quicklinksStatus')}
						/>
					</div>
				</div>
			</ScrollArea>
		</div>
	);
};

export default Home;
