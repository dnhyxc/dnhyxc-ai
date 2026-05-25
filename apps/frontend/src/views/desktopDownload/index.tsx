import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@ui/index';
import { ScrollArea } from '@ui/scroll-area';
import { Toast } from '@ui/sonner';
import {
	Apple,
	ArrowUpRight,
	CheckCircle2,
	Copy,
	Download,
	ExternalLink,
	Languages,
	Laptop,
	Monitor,
	Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n, useStandalonePageLocaleFromSearch, useTheme } from '@/hooks';
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
 * 桌面端下载落地页：独立全屏、默认浏览器打开为主场景；含平台切换、主下载、更新说明与手册外链。
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
		navigate(`${base}/?lang=${locale === 'en-US' ? 'zh-CN' : 'en-US'}`);
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

	const secondaryLinks = (
		<div className="flex flex-wrap items-center justify-center gap-3 text-sm text-textcolor/55">
			<button
				type="button"
				className="cursor-pointer inline-flex items-center gap-1 underline-offset-4 hover:text-textcolor hover:underline"
				onClick={() => navigate('/update-info')}
			>
				{t('downloadPage.links.releaseNotes')}
				<ArrowUpRight className="size-3.5" />
			</button>
			<span className="text-textcolor/25" aria-hidden>
				·
			</span>
			<button
				type="button"
				className="cursor-pointer inline-flex items-center gap-1 underline-offset-4 hover:text-textcolor hover:underline"
				onClick={() => navigate('/project-guide')}
			>
				{t('downloadPage.links.userGuide')}
				<ArrowUpRight className="size-3.5" />
			</button>
			<span className="text-textcolor/25" aria-hidden>
				·
			</span>
			<button
				type="button"
				className="cursor-pointer inline-flex items-center gap-1 underline-offset-4 hover:text-textcolor hover:underline"
				onClick={() => navigate('/')}
			>
				{t('downloadPage.links.backHome')}
			</button>
		</div>
	);

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

			<ScrollArea className="min-h-0 flex-1" viewportClassName="pb-8">
				<div className="relative isolate overflow-hidden">
					<div
						className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35]"
						aria-hidden
					>
						<div className="absolute -left-1/4 top-0 h-[420px] w-[120%] bg-[radial-gradient(ellipse_at_50%_0%,rgba(45,212,191,0.22),transparent_55%)]" />
						<div className="absolute right-[-20%] top-24 h-[380px] w-[70%] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.12),transparent_65%)] blur-2xl" />
					</div>

					<section className="mx-auto max-w-3xl px-4 pb-10 pt-10 text-center sm:px-6 sm:pt-14">
						<div className="mb-4 inline-flex items-center gap-2 rounded-full border border-theme/5 bg-theme-white/5 px-3 py-1 text-xs font-medium text-textcolor/70 backdrop-blur-sm">
							<Sparkles className="size-3.5 text-teal-400/90" />
							{t('downloadPage.hero.badge')}
						</div>
						<h2
							className="py-5 text-balance text-3xl font-bold tracking-tight text-textcolor sm:text-4xl"
							style={{ fontFamily: '"Syne", "Noto Sans SC", sans-serif' }}
						>
							{t('downloadPage.hero.title')}
						</h2>
						<p className="mx-auto mt-4 text-pretty text-[15px] leading-relaxed text-textcolor/65">
							{t('downloadPage.hero.subtitle')}
						</p>

						<div className="mt-8 flex flex-wrap items-center justify-center gap-2">
							<span className="rounded-md border border-theme/5 bg-theme-card/80 px-3 py-1.5 font-mono text-xs tabular-nums text-textcolor/80">
								{t('downloadPage.hero.versionLabel', {
									version: release.version,
								})}
							</span>
							{pubFormatted ? (
								<span className="rounded-md border border-theme/5 bg-theme-card/60 px-3 py-1.5 text-xs text-textcolor/55">
									{t('downloadPage.hero.dateLabel', { date: pubFormatted })}
								</span>
							) : null}
						</div>

						{osTab === 'mac' ? (
							<div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
								<Button
									size="lg"
									className="h-12 min-w-[220px] rounded-lg bg-linear-to-r from-teal-500 to-cyan-600 px-8 text-base font-semibold text-white shadow-lg shadow-teal-500/20 hover:opacity-85"
									onClick={() => openExternal(release.macAarch64DmgUrl)}
								>
									<Download className="mr-2 size-5" strokeWidth={2} />
									{t('downloadPage.hero.primaryCtaMac')}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="lg"
									className="h-12 border-theme/5 bg-theme/5"
									onClick={copyDmgUrl}
								>
									<Copy className="mr-2 size-4" />
									{t('downloadPage.hero.copyLink')}
								</Button>
							</div>
						) : (
							<p className="mt-10 text-sm text-textcolor/55">
								{t('downloadPage.hero.pickPlatform')}
							</p>
						)}

						<div className="mt-8">{secondaryLinks}</div>
					</section>

					<section className="mx-auto max-w-4xl px-4 py-5 sm:px-5 border border-theme/5 shadow-sm rounded-xl">
						<p className="mb-4 text-sm font-medium uppercase tracking-wider text-textcolor/60">
							{t('downloadPage.platforms.sectionLabel')}
						</p>
						<div
							className="flex justify-start gap-2 mb-5 backdrop-blur-sm"
							role="tablist"
							aria-label={t('downloadPage.platforms.sectionLabel')}
						>
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
							).map(({ id, icon: Icon, label }) => (
								<Button
									key={id}
									variant="ghost"
									role="tab"
									aria-selected={osTab === id}
									onClick={() => setOsTab(id)}
									className={`cursor-pointer flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:flex-none sm:px-6 ${
										osTab === id
											? 'bg-theme-background text-white border border-theme/5 bg-linear-to-r from-teal-500 to-cyan-600'
											: 'text-textcolor/55 hover:text-textcolor/80 border border-theme/5'
									}`}
								>
									<Icon className="size-4 shrink-0 opacity-80" />
									{label}
								</Button>
							))}
						</div>

						{osTab === 'mac' ? (
							<Card className="bg-theme-card/80 shadow-none backdrop-blur-sm border border-theme/5">
								<CardHeader>
									<CardTitle className="text-lg">
										{t('downloadPage.mac.cardTitle')}
									</CardTitle>
									<CardDescription className="text-textcolor/60">
										{t('downloadPage.mac.cardDesc')}
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
										<Button
											className="w-full sm:w-auto bg-linear-to-r from-teal-500 to-cyan-600 hover:opacity-85"
											onClick={() => openExternal(release.macAarch64DmgUrl)}
										>
											<Download className="mr-2 size-4" />
											{t('downloadPage.mac.downloadDmg')}
										</Button>
										{release.macAarch64TarGzUrl ? (
											<Button
												type="button"
												variant="outline"
												className="w-full border-theme/5 sm:w-auto"
												onClick={() =>
													openExternal(release.macAarch64TarGzUrl!)
												}
											>
												{t('downloadPage.mac.downloadTarGz')}
											</Button>
										) : null}
									</div>
									<ul className="space-y-2 text-sm text-textcolor/68">
										<li className="flex gap-2">
											<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-500/90" />
											{t('downloadPage.mac.stepInstall')}
										</li>
										<li className="flex gap-2">
											<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-500/90" />
											{t('downloadPage.mac.stepGatekeeper')}
										</li>
										<li className="flex gap-2">
											<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-500/90" />
											{t('downloadPage.mac.stepUpdater')}
										</li>
									</ul>
									<div className="rounded-lg border border-theme/5 bg-theme-background/5 px-4 py-3">
										<p className="mb-3 text-sm leading-relaxed text-textcolor/65">
											{t('downloadPage.mac.historyIntro')}
										</p>
										<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="w-full justify-center border-theme/5 sm:w-auto"
												onClick={() =>
													openExternal(getDesktopGithubReleasesPageUrl())
												}
											>
												{t('downloadPage.mac.openAllReleases')}
												<ExternalLink className="ml-2 size-3.5 opacity-70" />
											</Button>
										</div>
									</div>
								</CardContent>
								<CardFooter className="flex-col items-start gap-1 border-t border-theme/5 pt-6 text-xs leading-relaxed text-textcolor/45">
									<p>{t('downloadPage.mac.noteIntel')}</p>
									<p>{t('downloadPage.mac.noteSource')}</p>
								</CardFooter>
							</Card>
						) : null}

						{osTab === 'windows' ? (
							<Card className="bg-theme-card/80 shadow-none backdrop-blur-sm border border-theme/5">
								<CardHeader>
									<CardTitle className="text-lg">
										{t('downloadPage.windows.cardTitle')}
									</CardTitle>
									<CardDescription className="text-textcolor/60">
										{t('downloadPage.windows.cardDesc')}
									</CardDescription>
								</CardHeader>
								<CardFooter>
									<Button
										type="button"
										disabled
										variant="secondary"
										className="w-full sm:w-auto"
									>
										{t('downloadPage.windows.comingSoon')}
									</Button>
								</CardFooter>
							</Card>
						) : null}

						{osTab === 'linux' ? (
							<Card className="bg-theme-card/80 shadow-none backdrop-blur-sm border border-theme/5">
								<CardHeader>
									<CardTitle className="text-lg">
										{t('downloadPage.linux.cardTitle')}
									</CardTitle>
									<CardDescription className="text-textcolor/60">
										{t('downloadPage.linux.cardDesc')}
									</CardDescription>
								</CardHeader>
								<CardFooter>
									<Button
										type="button"
										disabled
										variant="secondary"
										className="w-full sm:w-auto"
									>
										{t('downloadPage.linux.comingSoon')}
									</Button>
								</CardFooter>
							</Card>
						) : null}
					</section>

					<section className="mx-auto max-w-3xl px-4 pb-5 pt-4 sm:px-6">
						<h3 className="mb-3 text-center text-sm font-semibold text-textcolor">
							{t('downloadPage.requirements.title')}
						</h3>
						<div className="mx-auto max-w-xl space-y-2 text-center text-sm text-textcolor/60">
							<p>{t('downloadPage.requirements.itemNet')}</p>
							<p>{t('downloadPage.requirements.itemMac')}</p>
							<p>{t('downloadPage.requirements.itemAccount')}</p>
						</div>
					</section>
				</div>
			</ScrollArea>
		</div>
	);
};

export default DesktopDownloadPage;
