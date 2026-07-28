import { SquarePen } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	fetchPluginRegistry,
	type PluginDescriptor,
	pickPluginLocaleText,
	pluginManager,
} from '@/plugins';

/** 标题只认 registry.title[locale]，缺省回退 id */
function pluginTitle(p: PluginDescriptor, locale: string) {
	return pickPluginLocaleText(p.title, locale) || p.id;
}

/** 描述只认 registry.description，缺省占位文案 */
function pluginBlurb(
	p: PluginDescriptor,
	locale: string,
	t: (k: string) => string,
) {
	return (
		pickPluginLocaleText(p.description, locale) || t('plugins.card.noDesc')
	);
}

export default function PluginsPage() {
	const { t, locale } = useI18n();
	const navigate = useNavigate();
	const [plugins, setPlugins] = useState<PluginDescriptor[]>([]);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const refresh = useCallback(async () => {
		try {
			const reg = await fetchPluginRegistry({ force: true });
			setPlugins(reg.plugins);
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const onToggle = async (id: string, enabled: boolean) => {
		setBusyId(id);
		try {
			await pluginManager.setEnabled(id, enabled);
			await refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusyId(null);
		}
	};

	return (
		<div className="box-border flex h-full min-h-0 w-full flex-col p-5.5 pt-0">
			<div className="bg-theme-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
				<div className="mb-2 flex shrink-0 items-center justify-between gap-3 px-4 pt-1.5">
					<p className="text-textcolor/55 min-w-0 flex-1 text-sm leading-relaxed">
						{t('plugins.page.desc')}
					</p>
					<Button
						type="button"
						variant="link"
						size="sm"
						className="text-textcolor px-0! gap-1 lucide-stroke-draw-hover"
						onClick={() => navigate('/plugins/registry')}
					>
						<SquarePen className="size-4" />
						{t('plugins.page.editRegistry')}
					</Button>
				</div>
				{error ? (
					<p className="text-destructive mb-3 shrink-0 px-4 text-sm">{error}</p>
				) : null}

				{plugins.length === 0 ? (
					<p className="text-textcolor/55 px-4 text-sm">
						{t('plugins.page.empty')}
					</p>
				) : (
					<ScrollArea className="min-h-0 flex-1">
						<div className="grid grid-cols-1 gap-4 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
							{plugins.map((p) => {
								const onShelf = p.enabled;
								const busy = busyId === p.id;
								return (
									<Card
										key={p.id}
										className={cn(
											'gap-2 py-4 flex flex-col justify-around border border-theme/5 bg-theme/5',
											!onShelf && 'opacity-80',
										)}
									>
										<CardHeader className="grid-cols-1 gap-2 px-4 [.border-b]:pb-0">
											<div className="flex items-center justify-between gap-3">
												<CardTitle className="min-w-0 flex-1 text-base">
													{pluginTitle(p, locale)}
												</CardTitle>
												<div className="flex shrink-0 items-center gap-2">
													<span className="text-textcolor/55 text-xs whitespace-nowrap">
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
											<CardDescription className="text-textcolor/70 line-clamp-3 text-sm leading-relaxed text-justify">
												{pluginBlurb(p, locale, t)}
											</CardDescription>
										</CardHeader>
										<CardContent className="px-4 text-xs text-textcolor/45">
											<p className="font-mono">
												{p.id} · v{p.version}
											</p>
											<p className="mt-1 truncate" title={p.routePath}>
												{t('plugins.card.route')}: {p.routePath}
											</p>
											<p className="mt-1">
												{t('plugins.card.trust')}: {p.trust}
											</p>
										</CardContent>
									</Card>
								);
							})}
						</div>
					</ScrollArea>
				)}
			</div>
		</div>
	);
}
