import {
	type ComponentType,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	type AttachIframeBridgeOptions,
	attachIframeBridge,
} from '../bridge/attachIframeBridge';
import { eventBus } from '../host-api/EventBus';
import type { PluginManager } from '../runtime/createPluginRuntime';
import { attachPluginStyleIsolation, styleRealmKey } from '../style-isolation';
import type { HostBridgeProps, HostLocale, LoadedPlugin } from '../types';

/** 避免 Host 侧 `PluginManager<RouteConfig>` 与默认泛型声明冲突 */
export type PluginHostManager = Pick<PluginManager, 'get' | 'ensurePlugin'>;

export type PluginHostViewVariant = 'default' | 'toolbar';

export type PluginHostViewSlots = {
	loading?: (ctx: {
		pluginId: string;
		variant: PluginHostViewVariant;
	}) => ReactNode;
	error?: (ctx: {
		pluginId: string;
		error: string;
		retry: () => void;
		busy: boolean;
		variant: PluginHostViewVariant;
	}) => ReactNode;
	missingIframeUrl?: (ctx: { pluginId: string }) => ReactNode;
	shell?: (node: ReactNode) => ReactNode;
	/** 挂到插件根节点的额外 className */
	rootClassName?: string;
};

export type PluginHostViewProps = {
	pluginId: string;
	manager: PluginHostManager;
	locale: HostLocale;
	iframeBridge: AttachIframeBridgeOptions;
	pageShell?: boolean;
	/** toolbar 紧凑态；影响 loading/error slots 的 variant */
	variant?: PluginHostViewVariant;
	className?: string;
	slots?: PluginHostViewSlots;
	ErrorBoundary?: ComponentType<{
		pluginId: string;
		children: ReactNode;
	}>;
};

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
	iframeBridge,
}: {
	pluginId: string;
	src: string;
	bridge: HostBridgeProps;
	iframeBridge: AttachIframeBridgeOptions;
}) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	// 用 ref 持有最新 bridge/opts，避免 identity 抖动反复 detach/attach 打满 postMessage
	const bridgeRef = useRef(bridge);
	const optsRef = useRef(iframeBridge);
	bridgeRef.current = bridge;
	optsRef.current = iframeBridge;

	useEffect(() => {
		const el = iframeRef.current;
		if (!el) return;
		let origin: string;
		try {
			origin = new URL(src).origin;
		} catch {
			return;
		}
		const detach = attachIframeBridge(
			el,
			bridgeRef.current,
			origin,
			optsRef.current,
		);
		return () => {
			// 先停掉 embed 文档再卸 bridge：跨域 iframe 在路由切换时硬拆会导致 WebView 主线程卡死（空白无报错）
			try {
				el.src = 'about:blank';
			} catch {
				/* ignore */
			}
			detach();
		};
	}, [src]);

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

/** 通用插件挂载视图（无 Host design 依赖；UI 经 slots 注入） */
export function PluginHostView({
	pluginId,
	manager,
	locale,
	iframeBridge,
	pageShell,
	variant = 'default',
	className,
	slots,
	ErrorBoundary,
}: PluginHostViewProps) {
	const [retryKey, setRetryKey] = useState(0);
	// 未 activated / failed 时默认 busy，避免首屏在 ensurePlugin 前闪「不可用」
	const [busy, setBusy] = useState(() => {
		const s = manager.get(pluginId)?.status;
		return s !== 'activated' && s !== 'failed';
	});
	const [error, setError] = useState<string | null>(() => {
		const cur = manager.get(pluginId);
		return cur?.status === 'failed' ? (cur.error ?? null) : null;
	});
	const [, bump] = useState(0);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const cur = manager.get(pluginId);
			if (cur?.status === 'activated') {
				setBusy(false);
				setError(null);
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
				await manager.ensurePlugin(pluginId, { force: retryKey > 0 });
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
	}, [pluginId, retryKey, manager]);

	const loaded: LoadedPlugin | undefined = manager.get(pluginId);
	const entry = loaded?.meta.entry;
	const trust = loaded?.meta.trust;
	const status = loaded?.status;

	useLayoutEffect(() => {
		if (status !== 'activated' || trust === 'untrusted' || !entry) return;
		return attachPluginStyleIsolation(pluginId, entry, loaded?.meta.remoteName);
	}, [pluginId, status, entry, trust, loaded?.meta.remoteName]);

	useEffect(() => {
		if (status !== 'activated') return;
		eventBus.emit(pluginId, 'locale', locale);
	}, [pluginId, status, locale]);

	const liveBridge = useMemo(
		() => (loaded?.bridge ? withLiveLocale(loaded.bridge, locale) : null),
		[loaded?.bridge, locale],
	);

	const wrap = (node: ReactNode) => {
		const inner = pageShell && slots?.shell ? slots.shell(node) : node;
		return inner;
	};

	const Bound = ErrorBoundary;

	if (loaded?.status === 'activated') {
		if (loaded.meta.trust === 'untrusted') {
			const src = loaded.meta.iframeUrl?.trim();
			if (!src) {
				return wrap(
					slots?.missingIframeUrl?.({ pluginId }) ?? (
						<div>missing iframeUrl: {pluginId}</div>
					),
				);
			}
			const body = (
				<UntrustedIframe
					pluginId={pluginId}
					src={src}
					bridge={loaded.bridge}
					iframeBridge={iframeBridge}
				/>
			);
			return wrap(Bound ? <Bound pluginId={pluginId}>{body}</Bound> : body);
		}

		if (!liveBridge) return null;
		const Comp = loaded.mod.default;
		const realm = styleRealmKey(
			loaded.meta.entry,
			loaded.meta.remoteName,
			pluginId,
		);
		const body = (
			<div
				className={[
					slots?.rootClassName,
					className,
					`plugin-${pluginId}`,
					'h-full w-full min-h-0',
				]
					.filter(Boolean)
					.join(' ')}
				data-mf-plugin={pluginId}
				data-mf-style-realm={realm}
				data-plugin-root
			>
				<Comp {...liveBridge} />
			</div>
		);
		return wrap(Bound ? <Bound pluginId={pluginId}>{body}</Bound> : body);
	}

	const failed = Boolean(error) || loaded?.status === 'failed';
	// 尚未 ensure / 加载中：一律 Loading，勿把「not loaded」当成不可用
	if (busy || loaded?.status === 'loading' || !failed) {
		return wrap(
			slots?.loading?.({ pluginId, variant }) ?? (
				<div className="text-textcolor">loading {pluginId}...</div>
			),
		);
	}

	const detail = error || loaded?.error || 'failed';

	return wrap(
		slots?.error?.({
			pluginId,
			error: detail,
			busy,
			retry: () => setRetryKey((n) => n + 1),
			variant,
		}) ?? (
			<div className="text-textcolor">
				unavailable {pluginId}: {detail}
				<button type="button" onClick={() => setRetryKey((n) => n + 1)}>
					retry
				</button>
			</div>
		),
	);
}
