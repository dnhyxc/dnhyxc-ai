import {
	createContext,
	createElement,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import type { AttachIframeBridgeOptions } from '../bridge/attachIframeBridge';
import type { HostTheme, PluginHostConfig } from '../config/types';
import { type FederationHost, getDefaultFederation } from '../createFederation';
import type { HostLocale } from '../types';
import {
	type PluginHostManager,
	PluginHostView,
	type PluginHostViewProps,
	type PluginHostViewSlots,
	type PluginHostViewVariant,
} from './PluginHostView';

const FederationContext = createContext<FederationHost | null>(null);

export function FederationProvider({
	host,
	children,
}: {
	host: FederationHost;
	children: ReactNode;
}) {
	return createElement(FederationContext.Provider, { value: host }, children);
}

export function useFederation(): FederationHost {
	const ctx = useContext(FederationContext);
	const host = ctx ?? getDefaultFederation();
	if (!host) {
		throw new Error(
			'[federation-kit] 请先 createFederation() / <FederationProvider>，或 asDefault: true',
		);
	}
	return host;
}

/** 避免 PluginManager 私有字段导致的泛型不兼容 */
export type FederationPluginHost = {
	manager: PluginHostManager;
	config: Pick<
		PluginHostConfig,
		'capabilities' | 'iframeChannel' | 'iframeRpcHandlers'
	>;
	getIframeBridgeOptions: () => AttachIframeBridgeOptions;
};

export type FederationPluginProps = {
	/** 插件 id（与 registry 一致）；也可用 name */
	name?: string;
	pluginId?: string;
	className?: string;
	pageShell?: boolean;
	variant?: PluginHostViewVariant;
	/** 兼容旧 part=toolbar */
	part?: 'toolbar' | 'drawer-triggers' | 'drawer';
	slots?: PluginHostViewSlots;
	locale?: HostLocale;
	/** 可选；缺省跟 capabilities.getTheme + onAppearanceChange */
	theme?: HostTheme;
	ErrorBoundary?: PluginHostViewProps['ErrorBoundary'];
	/** 覆盖默认 host；跨入口双份打包时建议显式传入 */
	host?: FederationPluginHost;
};

/**
 * 声明式挂载（≈ `<micro-app name="xxx" />`）。
 * 依赖 `createFederation({ asDefault: true })` 或外包 `<FederationProvider>`。
 */
export function FederationPlugin({
	name,
	pluginId,
	className,
	pageShell,
	variant,
	part,
	slots,
	locale: localeProp,
	theme: themeProp,
	ErrorBoundary,
	host: hostProp,
}: FederationPluginProps) {
	const ctxHost = useFederationSafe();
	const host = hostProp ?? ctxHost;
	if (!host) {
		throw new Error(
			'[federation-kit] FederationPlugin 需要 createFederation() 或 FederationProvider',
		);
	}

	const id = pluginId ?? name;
	if (!id) {
		throw new Error('[federation-kit] FederationPlugin 需要 name 或 pluginId');
	}

	const resolvedVariant: PluginHostViewVariant =
		variant ?? (part === 'toolbar' ? 'toolbar' : 'default');

	const [locale, setLocale] = useState<HostLocale>(
		() => localeProp ?? host.config.capabilities.getLocale(),
	);

	const [theme, setTheme] = useState<HostTheme>(
		() => themeProp ?? host.config.capabilities.getTheme(),
	);

	useEffect(() => {
		if (localeProp) {
			setLocale(localeProp);
			return;
		}
		setLocale(host.config.capabilities.getLocale());
		return host.config.capabilities.onLocaleChange?.((next) => {
			setLocale(next);
		});
	}, [host, localeProp]);

	useEffect(() => {
		if (themeProp) {
			setTheme(themeProp);
			return;
		}
		// getTheme 只在 effect 挂载时跑一次，对齐当前主题
		setTheme(host.config.capabilities.getTheme());
		// 复用 iframe 已接好的 appearance 通道；仅取 theme，accent 变化时同值 setTheme 会被 React 跳过
		return host.config.capabilities.onAppearanceChange?.((next) => {
			// Host 后续切亮/暗只走此回调；不 setTheme 则本地 state 仍是旧值，PluginHostView 跟不上
			setTheme(next.theme);
		});
	}, [host, themeProp]);

	const iframeBridge: AttachIframeBridgeOptions = useMemo(
		() => host.getIframeBridgeOptions(),
		[host],
	);

	return createElement(PluginHostView, {
		pluginId: id,
		manager: host.manager,
		locale,
		theme,
		iframeBridge,
		pageShell,
		variant: resolvedVariant,
		className,
		slots,
		ErrorBoundary,
	});
}

/** 可选：未配置时返回 null（给包装层 fallback） */
export function useFederationSafe(): FederationHost | null {
	return useContext(FederationContext) ?? getDefaultFederation();
}

/** @deprecated 别名，更短 */
export const Plugin = FederationPlugin;
