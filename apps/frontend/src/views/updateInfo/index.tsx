import { Button, ScrollArea } from '@ui/index';
import { ArrowDownToLine, ArrowUpToLine } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n, useStandalonePageLocaleFromSearch, useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	getUpdateInfoIntro,
	getUpdateInfoSections,
} from './updateInfoSections';

const SCROLL_BOTTOM_THRESHOLD = 48;

/**
 * 更新信息：独立全屏页（顶栏 + 滚动区 + 置底按钮），内容区为常规产品页排版，非 Markdown 文档样式。
 */
const UpdateInfoPage = () => {
	useStandalonePageLocaleFromSearch();
	const { t, locale } = useI18n();
	useTheme();

	const sections = useMemo(() => getUpdateInfoSections(locale), [locale]);
	const intro = useMemo(() => getUpdateInfoIntro(locale), [locale]);

	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const [scrollMetrics, setScrollMetrics] = useState({
		top: 0,
		scrollHeight: 0,
		clientHeight: 0,
	});

	const syncScrollMetrics = useCallback(() => {
		const el = scrollViewportRef.current;
		if (!el) return;
		setScrollMetrics({
			top: el.scrollTop,
			scrollHeight: el.scrollHeight,
			clientHeight: el.clientHeight,
		});
	}, []);

	useEffect(() => {
		syncScrollMetrics();
		const id = requestAnimationFrame(() => syncScrollMetrics());
		return () => cancelAnimationFrame(id);
	}, [syncScrollMetrics]);

	useEffect(() => {
		const el = scrollViewportRef.current;
		if (!el) return;
		const ro = new ResizeObserver(() => syncScrollMetrics());
		ro.observe(el);
		return () => ro.disconnect();
	}, [syncScrollMetrics]);

	const scrollToTop = () => {
		scrollViewportRef.current?.scrollTo({ top: 0, behavior: 'auto' });
	};

	const scrollToBottom = () => {
		const el = scrollViewportRef.current;
		if (!el) return;
		el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
	};

	const { top: scrollTop, scrollHeight, clientHeight } = scrollMetrics;
	const maxScroll = Math.max(0, scrollHeight - clientHeight);
	const canScroll = maxScroll > 4;
	const atBottom =
		!canScroll ||
		scrollTop + clientHeight >= scrollHeight - SCROLL_BOTTOM_THRESHOLD;

	const onScrollFabClick = () => {
		if (!canScroll) return;
		if (atBottom) scrollToTop();
		else scrollToBottom();
	};

	return (
		<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background text-textcolor">
			<header className="flex h-12.5 shrink-0 items-center gap-3 border-b border-theme/5 px-4">
				<h1 className="min-w-0 truncate text-base font-semibold">
					{t('route.updateInfo.title')}
				</h1>
			</header>

			<ScrollArea
				ref={scrollViewportRef}
				className="min-h-0 flex-1"
				viewportClassName="pb-1"
				onScroll={syncScrollMetrics}
			>
				<main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
					<p className="mb-10 text-[15px] leading-7 text-textcolor/72">
						{intro}
					</p>

					{sections.map((section) => (
						<section key={section.id} className="pb-14 last:pb-4">
							<h2 className="mb-6 text-base font-semibold text-textcolor sm:text-lg">
								{section.title}
							</h2>
							<div className="flex flex-col gap-8">
								{section.items.map((item) => (
									<article key={item.id} className="scroll-mt-4">
										<div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
											<h3 className="text-[15px] font-medium leading-snug text-textcolor">
												{item.title}
											</h3>
											<time
												dateTime={item.dateLabel}
												className="shrink-0 text-xs tabular-nums text-textcolor/45"
											>
												{t('updateInfoPage.item.dateLabel', {
													date: item.dateLabel,
												})}
											</time>
										</div>
										<p className="mt-2.5 text-[14px] leading-7 text-textcolor/68">
											{item.description}
										</p>
									</article>
								))}
							</div>
						</section>
					))}
				</main>
			</ScrollArea>

			{canScroll ? (
				<Button
					title={
						atBottom ? t('share.scroll.toTop') : t('share.scroll.toBottom')
					}
					aria-label={
						atBottom
							? t('share.scroll.ariaToTop')
							: t('share.scroll.ariaToBottom')
					}
					onClick={onScrollFabClick}
					className={cn(
						'fixed bottom-5.5 right-5 z-50 flex size-10 items-center justify-center rounded-full',
						'border border-theme/20 bg-theme-background/95 text-textcolor/85 shadow-md backdrop-blur-sm',
						'transition-colors hover:border-theme/50 hover:bg-theme/10 hover:text-textcolor',
						'focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
					)}
				>
					{atBottom ? (
						<ArrowUpToLine className="size-5" strokeWidth={2} />
					) : (
						<ArrowDownToLine className="size-5" strokeWidth={2} />
					)}
				</Button>
			) : null}
		</div>
	);
};

export default UpdateInfoPage;
