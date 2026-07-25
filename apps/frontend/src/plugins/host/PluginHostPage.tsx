import { useEffect, useRef, useState } from 'react';
import Loading from '@/components/design/Loading';
import { Button } from '@/components/ui';
import { attachIframeBridge } from '../core/attachIframeBridge';
import { pluginManager } from '../core/PluginManager';
import type { HostBridgeProps } from '../core/types';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { attachPluginStyleIsolation } from './styleIsolation';

type Props = { pluginId: string };

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

export function PluginHostPage({ pluginId }: Props) {
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

	if (loaded?.status === 'activated') {
		if (loaded.meta.trust === 'untrusted') {
			const src = loaded.meta.iframeUrl?.trim();
			if (!src) {
				return (
					<div className="text-muted-foreground p-6 text-sm">
						插件「{pluginId}」为 untrusted，但缺少 iframeUrl
					</div>
				);
			}
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

		const Comp = loaded.mod.default;
		return (
			<PluginErrorBoundary pluginId={pluginId}>
				<div
					className={`plugin-${pluginId} h-full w-full`}
					data-mf-plugin={pluginId}
					data-plugin-root
				>
					<Comp {...loaded.bridge} />
				</div>
			</PluginErrorBoundary>
		);
	}

	const detail =
		error ||
		loaded?.error ||
		(busy || loaded?.status === 'loading'
			? '正在加载中...'
			: '未加载（请确认 Remote 已启动后重试）');

	return (
		<div className="mx-auto text-muted-foreground h-full flex flex-col gap-3 p-5.5 pt-0">
			<div className="bg-theme-background h-full p-4.5 rounded-md">
				{busy || loaded?.status === 'loading' ? (
					<Loading
						text={`插件「${pluginId}」正在加载中...`}
						className="flex items-center h-full"
					/>
				) : (
					<div className="flex flex-col gap-3">
						插件「{pluginId}」不可用
						{detail ? `：${detail}` : ''}
						{error || loaded?.error ? (
							<Button
								type="button"
								variant={busy ? 'loading' : 'default'}
								className="w-fit"
								disabled={busy}
								onClick={() => setRetryKey((n) => n + 1)}
							>
								重新加载
							</Button>
						) : null}
					</div>
				)}
			</div>
		</div>
	);
}
