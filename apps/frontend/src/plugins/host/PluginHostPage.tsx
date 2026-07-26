import { useEffect, useMemo, useRef, useState } from 'react';
import Loading from '@/components/design/Loading';
import { Button } from '@/components/ui';
import { useI18n } from '@/hooks';
import { cn } from '@/lib/utils';
import { attachIframeBridge } from '../core/attachIframeBridge';
import { pluginManager } from '../core/PluginManager';
import type { HostBridgeProps, HostLocale } from '../core/types';
import { eventBus } from '../host-api/EventBus';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { attachPluginStyleIsolation } from './styleIsolation';

type Props = { pluginId: string; className?: string };

/** 用 Host 当前语言覆盖 bridge 快照；插件自维护 t，只同步 locale */
function withLiveLocale(
	bridge: HostBridgeProps,
	locale: HostLocale,
): HostBridgeProps {
	return {
		...bridge,
		api: {
			...bridge.api,
			locale,
		},
	};
}

function UntrustedIframe({
	pluginId,
	src,
	bridge,
}: {
	pluginId: string;
	src: string;
	bridge: HostBridgeProps;
}) {
	const iframeRef = useRef<HTMLIFrameElement>(null);

	useEffect(() => {
		const el = iframeRef.current;
		if (!el) return;
		let origin: string;
		try {
			origin = new URL(src).origin;
		} catch {
			return;
		}
		return attachIframeBridge(el, bridge, origin);
	}, [src, bridge]);

	return (
		<iframe
			ref={iframeRef}
			title={pluginId}
			src={src}
			className="h-full w-full border-0"
			data-mf-plugin={pluginId}
			data-mf-trust="untrusted"
			sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
		/>
	);
}

export function PluginHostPage({ pluginId, className }: Props) {
	const { locale, t } = useI18n();
	const [retryKey, setRetryKey] = useState(0);
	const [busy, setBusy] = useState(
		() => pluginManager.get(pluginId)?.status === 'loading',
	);
	const [error, setError] = useState<string | null>(() => {
		const cur = pluginManager.get(pluginId);
		return cur?.status === 'failed' ? (cur.error ?? null) : null;
	});
	const [, bump] = useState(0);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const cur = pluginManager.get(pluginId);
			if (cur?.status === 'activated') {
				bump((n) => n + 1);
				return;
			}
			if (cur?.status === 'failed' && retryKey === 0) {
				setError(cur.error ?? null);
				setBusy(false);
				return;
			}

			setBusy(true);
			setError(null);
			try {
				await pluginManager.ensurePlugin(pluginId, {
					force: retryKey > 0,
				});
			} catch (e) {
				if (!cancelled) {
					setError(e instanceof Error ? e.message : String(e));
				}
			} finally {
				if (!cancelled) {
					setBusy(false);
					bump((n) => n + 1);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [pluginId, retryKey]);

	const loaded = pluginManager.get(pluginId);
	const entry = loaded?.meta.entry;
	const trust = loaded?.meta.trust;
	const status = loaded?.status;

	useEffect(() => {
		if (status !== 'activated' || trust === 'untrusted' || !entry) return;
		return attachPluginStyleIsolation(pluginId, entry);
	}, [pluginId, status, entry, trust]);

	// 已激活插件经 eventBus 收 locale（与 bridge.api.locale 热更新互补）
	useEffect(() => {
		if (status !== 'activated') return;
		eventBus.emit(pluginId, 'locale', locale);
	}, [pluginId, status, locale]);

	const liveBridge = useMemo(
		() => (loaded?.bridge ? withLiveLocale(loaded.bridge, locale) : null),
		[loaded?.bridge, locale],
	);

	if (loaded?.status === 'activated') {
		if (loaded.meta.trust === 'untrusted') {
			const src = loaded.meta.iframeUrl?.trim();
			if (!src) {
				return (
					<div className="text-muted-foreground p-6 text-sm">
						{t('plugins.host.missingIframeUrl', { id: pluginId })}
					</div>
				);
			}
			// iframe 语言靠 attachIframeBridge 的 init + onListen('locale') 推送，勿用 liveBridge 以免重挂
			return (
				<PluginErrorBoundary pluginId={pluginId}>
					<UntrustedIframe
						pluginId={pluginId}
						src={src}
						bridge={loaded.bridge}
					/>
				</PluginErrorBoundary>
			);
		}

		if (!liveBridge) return null;
		const Comp = loaded.mod.default;
		return (
			<PluginErrorBoundary pluginId={pluginId}>
				<div
					className={`plugin-${pluginId} h-full w-full`}
					data-mf-plugin={pluginId}
					data-plugin-root
				>
					<Comp {...liveBridge} />
				</div>
			</PluginErrorBoundary>
		);
	}

	const detail =
		error ||
		loaded?.error ||
		(busy || loaded?.status === 'loading'
			? t('plugins.host.loading')
			: t('plugins.host.notLoaded'));

	return (
		<div
			className={cn(
				'mx-auto text-muted-foreground h-full flex flex-col gap-3 p-5.5 pt-0',
				className,
			)}
		>
			<div className="bg-theme-background h-full p-4.5 rounded-md">
				{busy || loaded?.status === 'loading' ? (
					<Loading
						text={t('plugins.host.loadingNamed', { id: pluginId })}
						className="flex items-center h-full"
					/>
				) : (
					<div className="flex flex-col gap-3">
						<span>
							{t('plugins.host.unavailable', { id: pluginId })}
							{detail ? `: ${detail}` : ''}
						</span>
						{error || loaded?.error ? (
							<Button
								type="button"
								variant={busy ? 'loading' : 'default'}
								className="w-fit"
								disabled={busy}
								onClick={() => setRetryKey((n) => n + 1)}
							>
								{t('plugins.host.reload')}
							</Button>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}
