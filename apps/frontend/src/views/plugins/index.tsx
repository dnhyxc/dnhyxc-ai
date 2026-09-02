import {
	AppWindow,
	Puzzle,
	SquareArrowOutUpRight,
	SquarePen,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
	ensurePluginEnabledPrefsLoaded,
	fetchPluginRegistry,
	isPluginEnabled,
	overlayUserEnabled,
	type PluginDescriptor,
	PluginIcon,
	pickPluginLocaleText,
	pluginManager,
	subscribePluginEnabled,
} from '@/federation';
import { useI18n, useIsSuperAdmin } from '@/hooks';
import { cn } from '@/lib/utils';
import { getRequestErrorMessage } from '@/utils/fetch';

type CatalogTab = 'plugin' | 'app';

/**
 * 业务面内嵌 / surface 槽 → 插件；独立路由注入 → 应用。
 * ponytail: 无显式 kind 字段时按 host / injectRoute 推断；若要运营手标，再给 registry 加 kind。
 */
function catalogKind(p: PluginDescriptor): CatalogTab {
	if (p.host || p.injectRoute === false) return 'plugin';
	return 'app';
}

function pluginTitle(p: PluginDescriptor, locale: string) {
	return pickPluginLocaleText(p.title, locale) || p.id;
}

function pluginBlurb(
	p: PluginDescriptor,
	locale: string,
	t: (k: string) => string,
) {
	return (
		pickPluginLocaleText(p.description, locale) || t('plugins.card.noDesc')
	);
}

function pluginIconUrl(p: PluginDescriptor) {
	return p.menu?.icon || p.host?.icon;
}

function trustLabel(trust: string, t: (k: string) => string) {
	const key = `plugins.card.trust.${trust}`;
	const gloss = t(key);
	return gloss === key ? trust : `${trust}（${gloss}）`;
}

export default function PluginsPage() {
	const { t, locale } = useI18n();
	const isSuperAdmin = useIsSuperAdmin();
	const navigate = useNavigate();
	const [plugins, setPlugins] = useState<PluginDescriptor[]>([]);
	const [tab, setTab] = useState<CatalogTab>('plugin');
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			await ensurePluginEnabledPrefsLoaded();
			const reg = await fetchPluginRegistry({ force: true });
			setPlugins(overlayUserEnabled(reg).plugins);
			setError(null);
		} catch (e) {
			setError(getRequestErrorMessage(e));
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	// 偏好变更时只重贴 enabled，避免再拉 registry → notify 死循环
	useEffect(() => {
		return subscribePluginEnabled(() => {
			setPlugins((prev) =>
				prev.map((p) => ({ ...p, enabled: isPluginEnabled(p.id) })),
			);
		});
	}, []);

	const visible = useMemo(
		() => plugins.filter((p) => catalogKind(p) === tab),
		[plugins, tab],
	);

	const counts = useMemo(() => {
		let plugin = 0;
		let app = 0;
		for (const p of plugins) {
			if (catalogKind(p) === 'plugin') plugin += 1;
			else app += 1;
		}
		return { plugin, app };
	}, [plugins]);

	const onToggle = async (id: string, enabled: boolean) => {
		setBusyId(id);
		try {
			await pluginManager.setEnabled(id, enabled);
			await refresh();
		} catch (e) {
			setError(getRequestErrorMessage(e));
		} finally {
			setBusyId(null);
		}
	};

	const tabs: {
		id: CatalogTab;
		label: string;
		Icon: typeof Puzzle;
		count: number;
	}[] = [
		{
			id: 'plugin',
			label: t('plugins.page.tab.plugin'),
			Icon: Puzzle,
			count: counts.plugin,
		},
		{
			id: 'app',
			label: t('plugins.page.tab.app'),
			Icon: AppWindow,
			count: counts.app,
		},
	];

	return (
		<div className="box-border flex h-full min-h-0 w-full flex-col p-5.5 pt-0">
			<div className="bg-theme-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
				<div
					className={cn(
						'mb-2 flex shrink-0 items-center gap-5 px-4 pt-1.5',
						!isSuperAdmin ? 'justify-between' : 'justify-start',
					)}
				>
					<div className="flex-1 min-w-0 flex items-center gap-5">
						<div
							className="flex h-8 shrink-0 items-center gap-4"
							role="tablist"
							aria-label={t('plugins.page.tabsAria')}
						>
							{tabs.map((item) => {
								const active = tab === item.id;
								return (
									<Button
										key={item.id}
										role="tab"
										aria-selected={active}
										variant="ghost"
										size="sm"
										className={cn(
											'px-0! hover:text-teal-500/80 shrink-0 gap-1 rounded-md font-medium hover:bg-transparent dark:hover:bg-transparent lucide-stroke-draw-hover',
											active ? 'text-teal-500' : 'text-textcolor',
										)}
										onClick={() => setTab(item.id)}
									>
										<item.Icon className="size-4" />
										<span className="mb-px">{item.label}</span>
										<span
											className={cn(
												'inline-flex min-w-4.5 items-center justify-center rounded-full px-1.5 py-px text-xs leading-none tabular-nums transition-colors',
												active
													? 'bg-teal-600 font-medium text-white'
													: 'bg-theme/10 text-textcolor/55',
											)}
										>
											{item.count}
										</span>
									</Button>
								);
							})}
						</div>
						<p
							className="text-textcolor/55 min-w-0 w-fit truncate text-xs leading-none"
							title={t('plugins.page.desc')}
						>
							{t('plugins.page.desc')}
						</p>
					</div>
					{isSuperAdmin ? (
						<Button
							type="button"
							variant="link"
							size="sm"
							className="text-textcolor shrink-0 px-0! gap-1 lucide-stroke-draw-hover"
							onClick={() => navigate('/plugins/registry')}
						>
							<SquarePen className="size-4" />
							<span className="mb-px">{t('plugins.page.editRegistry')}</span>
						</Button>
					) : null}
				</div>
				{error ? (
					<p className="text-destructive mb-3 shrink-0 px-4 text-sm">{error}</p>
				) : null}

				{visible.length === 0 ? (
					<p className="text-textcolor/55 px-4 text-sm">
						{t(
							tab === 'plugin'
								? 'plugins.page.empty.plugin'
								: 'plugins.page.empty.app',
						)}
					</p>
				) : (
					<div className="flex h-full flex-col overflow-auto pb-4">
						<ScrollArea className="min-h-0 flex-1">
							<div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 xl:grid-cols-3">
								{visible.map((p) => {
									const onShelf = p.enabled;
									const busy = busyId === p.id;
									const isApp = tab === 'app';
									const iconUrl = pluginIconUrl(p);
									return (
										<Card
											key={p.id}
											className={cn(
												// 显式 border-theme/5，避免裸 border 吃到被远程插件污染的 border-border 白边
												'flex flex-col gap-0 border border-theme/5 bg-theme/5 py-0 shadow-none',
											)}
										>
											<CardHeader className="gap-3 px-4 pt-4 pb-3">
												<div className="flex items-start justify-between gap-3">
													<div className="flex min-w-0 items-start gap-2.5">
														<span
															className={cn(
																'flex size-11 shrink-0 items-center justify-center rounded-md bg-theme/10',
																onShelf ? 'text-teal-500' : 'text-textcolor/50',
															)}
														>
															{iconUrl ? (
																<PluginIcon name={iconUrl} className="size-5" />
															) : isApp ? (
																<AppWindow className="size-5" />
															) : (
																<Puzzle className="size-5" />
															)}
														</span>
														<div className="min-w-0 flex flex-col gap-1">
															<CardTitle className="truncate text-base leading-snug">
																{pluginTitle(p, locale)}
															</CardTitle>
															<p className="text-textcolor/45 truncate font-mono text-[11px] leading-snug">
																{p.id}
																<span className="text-textcolor/30"> · </span>v
																{p.version}
															</p>
														</div>
													</div>
													<div className="flex shrink-0 items-center gap-2 pt-0.5">
														<span
															className={cn(
																'text-xs whitespace-nowrap',
																onShelf
																	? 'text-teal-500/80'
																	: 'text-textcolor/45',
															)}
														>
															{onShelf
																? t('plugins.shelf.on')
																: t('plugins.shelf.off')}
														</span>
														<Switch
															checked={onShelf}
															disabled={busy}
															onCheckedChange={(v) => void onToggle(p.id, v)}
															aria-label={t('plugins.shelf.toggle')}
														/>
													</div>
												</div>
												<CardDescription className="text-textcolor/65 line-clamp-2 text-sm leading-relaxed">
													{pluginBlurb(p, locale, t)}
												</CardDescription>
											</CardHeader>
											<CardFooter className="mt-auto h-11.5 flex items-end justify-between gap-3 border-t border-theme/5 px-4 pt-3.5 pb-3.5 [.border-t]:pt-3">
												<div className="text-textcolor/55 min-w-0 flex-1 text-sm leading-snug">
													<p className="truncate">
														{/* <span className="text-textcolor/55">
															{p.routePath}
														</span>
														<span className="text-textcolor/55"> · </span> */}
														{p.menu
															? t('plugins.card.sidebar.on')
															: t('plugins.card.sidebar.off')}
														{t('plugins.card.sidebar')}
														<span className="text-textcolor/55"> · </span>
														{trustLabel(p.trust, t)}
													</p>
												</div>
												{isApp ? (
													<Button
														type="button"
														variant="link"
														size="sm"
														className="lucide-stroke-draw-hover h-auto shrink-0 gap-1 px-0! text-teal-500/90"
														disabled={!onShelf || busy || !p.routePath}
														onClick={() => navigate(p.routePath)}
													>
														{t('plugins.card.enter')}
														<SquareArrowOutUpRight className="size-3.5 -mb-0.5" />
													</Button>
												) : null}
											</CardFooter>
										</Card>
									);
								})}
							</div>
						</ScrollArea>
					</div>
				)}
			</div>
		</div>
	);
}
