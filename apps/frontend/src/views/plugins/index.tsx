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
import { Switch } from '@/components/ui/switch';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import {
	fetchPluginRegistry,
	type PluginDescriptor,
	pluginManager,
} from '@/plugins';

function pluginTitle(p: PluginDescriptor, t: (k: string) => string) {
	const key = p.titleKey ?? p.menu?.nameKey;
	if (key) {
		const label = t(key);
		if (label && label !== key) return label;
	}
	return p.id;
}

function pluginBlurb(p: PluginDescriptor, t: (k: string) => string) {
	// 有 descriptionKey 时优先走 i18n，避免 registry 里残留的中文 description 锁死文案
	if (p.descriptionKey) {
		const label = t(p.descriptionKey);
		if (label && label !== p.descriptionKey) return label;
	}
	if (p.description?.trim()) return p.description.trim();
	return t('plugins.card.noDesc');
}

export default function PluginsPage() {
	const { t } = useI18n();
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
			<div className="p-4 pt-1.5 flex-1 bg-theme-background rounded-md">
				<div className="mb-2 flex shrink-0 items-center justify-between gap-3">
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
					<p className="text-destructive mb-3 text-sm">{error}</p>
				) : null}

				{plugins.length === 0 ? (
					<p className="text-textcolor/55 text-sm">{t('plugins.page.empty')}</p>
				) : (
					<div className="grid min-h-0 grid-cols-1 gap-4 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
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
												{pluginTitle(p, t)}
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
											{pluginBlurb(p, t)}
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
				)}
			</div>
		</div>
	);
}
