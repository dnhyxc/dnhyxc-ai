import { Button, Card, CardContent } from '@ui/index';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import {
	Apple,
	ArrowRight,
	CheckCircle2,
	Clock,
	Copy,
	Download,
	ExternalLink,
	Languages,
	Laptop,
	Monitor,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useStandalonePageLocaleFromSearch, useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
import { withStandaloneLangSearch } from '@/utils/public-doc-url';
import { DOWNLOAD_DESKTOP_PATH } from './paths';
import {
	getBundledDesktopRelease,
	getDesktopGithubReleasesPageUrl,
} from './releaseInfo';

type OsTab = 'mac' | 'windows' | 'linux';

function detectOsTab(): OsTab {
	if (typeof navigator === 'undefined') return 'mac';
	const ua = navigator.userAgent.toLowerCase();
	if (ua.includes('mac')) return 'mac';
	if (ua.includes('win')) return 'windows';
	if (ua.includes('linux')) return 'linux';
	return 'mac';
}

function formatPubDate(iso: string | undefined, locale: string): string {
	if (!iso) return '';
	try {
		const d = new Date(iso);
		return new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		}).format(d);
	} catch {
		return iso;
	}
}

/**
 * 桌面端下载落地页。
 * 单卡片承载核心内容；底栏简化为信息注脚区。
 */
const DesktopDownloadPage = () => {
	useStandalonePageLocaleFromSearch();
	const { t, locale } = useI18n();
	useTheme();
	const navigate = useNavigate();
	const release = useMemo(() => getBundledDesktopRelease(), []);
	const [osTab, setOsTab] = useState<OsTab>(() => detectOsTab());

	useEffect(() => {
		document.title = t('route.downloadDesktop.title');
	}, [t, locale]);

	const onToggleLanguage = useCallback(() => {
		const base = DOWNLOAD_DESKTOP_PATH.replace(/\/$/, '');
		const next = locale === 'en-US' ? 'zh-CN' : 'en-US';
		navigate(`${base}/?${withStandaloneLangSearch(next)}`);
	}, [locale, navigate]);

	const pubFormatted = useMemo(
		() => formatPubDate(release.pubDate, locale),
		[release.pubDate, locale],
	);

	const copyDmgUrl = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(release.macAarch64DmgUrl);
			Toast({
				type: 'success',
				title: t('downloadPage.toast.linkCopied'),
			});
		} catch {
			Toast({
				type: 'error',
				title: t('downloadPage.toast.copyFailed'),
			});
		}
	}, [release.macAarch64DmgUrl, t]);

	const openExternal = useCallback((url: string) => {
		window.open(url, '_blank', 'noopener,noreferrer');
	}, []);

	return (
		<div className="relative flex h-dvh w-full flex-col overflow-hidden bg-theme-background text-textcolor">
			<header className="flex h-12.5 shrink-0 items-center gap-3 border-b border-theme/5 bg-theme-background/90 pl-4 pr-2 backdrop-blur-md">
				<h1 className="min-w-0 flex-1 truncate text-base font-semibold">
					{t('route.downloadDesktop.title')}
				</h1>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					className="shrink-0 text-textcolor/70 hover:text-textcolor"
					title={t('header.toggleLanguage')}
					aria-label={t('header.toggleLanguage')}
					onClick={onToggleLanguage}
				>
					<Languages className="size-4" strokeWidth={2} />
				</Button>
			</header>

			<ScrollArea className="w-full min-h-0 flex-1" viewportClassName="w-full">
				{/* 背景光晕：跟随强调色 --brand-accent */}
				<div
					className="pointer-events-none absolute inset-0 -z-10 opacity-[0.85]"
					aria-hidden
					style={{
						background: [
							'radial-gradient(55% 70% at 9% 10%, color-mix(in oklch, var(--brand-accent) 5%, transparent), transparent 55%)',
							'radial-gradient(90% 70% at 70% 30%, color-mix(in oklch, var(--brand-accent) 10%, transparent), transparent 58%)',
							'radial-gradient(70% 55% at 10% 85%, color-mix(in oklch, var(--brand-accent-soft) 7%, transparent), transparent 52%)',
							'radial-gradient(55% 70% at 91% 90%, color-mix(in oklch, var(--brand-accent) 5%, transparent), transparent 55%)',
						].join(', '),
					}}
				/>

				{/* min-h-full + flex-1 + justify-center：矮于视口时垂直居中；超出时可滚 */}
				<div className="relative mx-auto flex min-h-full w-full max-w-4xl flex-1 flex-col justify-center px-6 py-10 mb-10">
					{/* === Hero 标题区 === */}
					<div className="mb-12 text-center">
						<h2 className="text-balance text-3xl font-bold leading-snug tracking-tight sm:text-[2.75rem]">
							<span
								className="bg-linear-to-r bg-clip-text text-transparent"
								style={{
									backgroundImage:
										'linear-gradient(90deg, var(--brand-accent), var(--brand-accent-soft))',
								}}
							>
								{t('downloadPage.hero.title')}
							</span>
						</h2>
						<p className="mx-auto mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-textcolor/55">
							{t('downloadPage.hero.subtitle')}
						</p>
					</div>

					{/* === 核心下载卡 === */}
					<Card className="w-full shrink-0 overflow-hidden rounded-lg border-theme/5 bg-theme-card/90 p-0 shadow-sm backdrop-blur-sm">
						{/* 顶栏：平台 tab + 版本号 */}
						<div className="flex flex-wrap items-center justify-between gap-3 border-b border-theme/5 px-8 py-3">
							<div className="flex items-center gap-1.5">
								{(
									[
										{
											id: 'mac' as const,
											icon: Apple,
											label: t('downloadPage.platforms.mac'),
										},
										{
											id: 'windows' as const,
											icon: Monitor,
											label: t('downloadPage.platforms.windows'),
										},
										{
											id: 'linux' as const,
											icon: Laptop,
											label: t('downloadPage.platforms.linux'),
										},
									] as const
								).map(({ id, icon: Icon, label }) => {
									const active = osTab === id;
									return (
										<button
											key={id}
											type="button"
											role="tab"
											aria-selected={active}
											onClick={() => setOsTab(id)}
											className={cn(
												'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
												active
													? 'bg-teal-500/80 text-white shadow-sm shadow-teal-500/20'
													: 'text-teal-500/70 hover:bg-teal-500/10 hover:text-teal-500',
											)}
										>
											<Icon className="size-3.5 shrink-0" />
											{label}
										</button>
									);
								})}
							</div>
							<div className="flex items-center gap-2 text-[11px] text-textcolor/40">
								<span className="relative flex size-1.5">
									<span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-400/50" />
									<span className="relative size-1.5 rounded-full bg-teal-500" />
								</span>
								<span className="font-mono tabular-nums">
									v{release.version}
								</span>
								{pubFormatted ? (
									<>
										<span>·</span>
										<span>{pubFormatted}</span>
									</>
								) : null}
							</div>
						</div>

						{/* macOS 内容区：上下堆叠 + 整体居中 */}
						{osTab === 'mac' ? (
							<CardContent className="flex flex-col items-center gap-6 px-8 py-12 text-center">
								{/* 上半：Apple Logo + 标题同排 + 描述 + 按钮 */}
								<div className="flex w-full flex-col items-center gap-3">
									<div className="flex items-center gap-2">
										<Apple
											className="size-6 text-textcolor/80"
											strokeWidth={1.5}
										/>
										<h3 className="text-lg font-semibold text-textcolor">
											{t('downloadPage.mac.cardTitle')}
										</h3>
									</div>
									<p className="text-sm leading-relaxed text-textcolor/55">
										{t('downloadPage.mac.cardDesc')}
									</p>
									<div className="mt-2 flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
										<Button
											size="lg"
											className="h-11 w-full rounded-lg px-6 text-sm font-semibold sm:w-[180px]"
											onClick={() => openExternal(release.macAarch64DmgUrl)}
										>
											<Download className="mr-2 size-4" strokeWidth={2} />
											{t('downloadPage.mac.downloadDmg')}
										</Button>
										{release.macAarch64TarGzUrl ? (
											<Button
												type="button"
												variant="outline"
												className="h-11 w-full rounded-lg px-4 text-sm sm:w-[180px]"
												onClick={() =>
													openExternal(release.macAarch64TarGzUrl!)
												}
											>
												{t('downloadPage.mac.downloadTarGz')}
											</Button>
										) : null}
									</div>
									<div className="mt-1 inline-flex items-center gap-4 text-[12px]">
										<button
											type="button"
											className="inline-flex h-8 cursor-pointer items-center gap-1.5 text-teal-500 transition-colors hover:text-teal-500/80"
											onClick={copyDmgUrl}
										>
											<Copy className="size-3" />
											{t('downloadPage.hero.copyLink')}
										</button>
										<button
											type="button"
											className="inline-flex h-8 cursor-pointer items-center gap-1.5 text-teal-500 transition-colors hover:text-teal-500/80"
											onClick={() =>
												openExternal(getDesktopGithubReleasesPageUrl())
											}
										>
											<ExternalLink className="size-3" />
											{t('downloadPage.mac.openAllReleases')}
										</button>
									</div>
								</div>

								{/* 下半：安装提示（整块居中、标题与条目左对齐，单行不换行） */}
								<div className="w-full pt-6">
									<div className="mx-auto w-fit max-w-full text-left">
										<p className="mb-3 text-sm text-textcolor/55 font-medium">
											{t('downloadPage.mac.installGuide')}
										</p>
										<ul className="flex flex-col gap-3.5">
											{(
												[
													'downloadPage.mac.stepInstall',
													'downloadPage.mac.stepGatekeeper',
													'downloadPage.mac.stepUpdater',
												] as const
											).map((key) => (
												<li
													key={key}
													className="flex items-center gap-2.5 whitespace-nowrap text-[13px] leading-relaxed text-textcolor/70"
												>
													<CheckCircle2
														className="size-4 shrink-0 text-teal-500"
														aria-hidden
													/>
													<span>{t(key)}</span>
												</li>
											))}
										</ul>
									</div>
								</div>
							</CardContent>
						) : null}

						{/* Windows / Linux Coming Soon */}
						{osTab === 'windows' || osTab === 'linux' ? (
							<CardContent className="flex flex-col items-center gap-4 px-8 py-12 text-center">
								{osTab === 'windows' ? (
									<Monitor className="size-10 text-textcolor/25" />
								) : (
									<Laptop className="size-10 text-textcolor/25" />
								)}
								<div className="inline-flex items-center gap-1.5 rounded-full bg-textcolor/5 px-3 py-1 text-[11px] text-textcolor/40">
									<Clock className="size-3" />
									{osTab === 'windows'
										? t('downloadPage.windows.comingSoon')
										: t('downloadPage.linux.comingSoon')}
								</div>
								<p className="w-full text-sm text-textcolor/50">
									{osTab === 'windows'
										? t('downloadPage.windows.cardDesc')
										: t('downloadPage.linux.cardDesc')}
								</p>
							</CardContent>
						) : null}

						{/* 底栏：纯信息注脚，不用 grid，用 flex + divider */}
						<div className="border-t border-theme/5 px-8 py-4">
							<div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-textcolor/45">
								<button
									type="button"
									className="cursor-pointer inline-flex items-center gap-1 transition-colors hover:text-teal-500"
									onClick={() => navigate('/update-info')}
								>
									{t('downloadPage.links.releaseNotes')}
									<ArrowRight className="size-3" />
								</button>
								<button
									type="button"
									className="cursor-pointer inline-flex items-center gap-1 transition-colors hover:text-teal-500"
									onClick={() => navigate('/project-guide')}
								>
									{t('downloadPage.links.userGuide')}
									<ArrowRight className="size-3" />
								</button>
								<button
									type="button"
									className="cursor-pointer inline-flex items-center gap-1 transition-colors hover:text-teal-500"
									onClick={() => navigate('/')}
								>
									{t('downloadPage.links.backHome')}
									<ArrowRight className="size-3" />
								</button>
							</div>
							<p className="mt-3 text-center text-[11px] leading-relaxed text-textcolor/35">
								{t('downloadPage.mac.noteIntel')}
							</p>
						</div>
					</Card>
				</div>
			</ScrollArea>
		</div>
	);
};

export default DesktopDownloadPage;
