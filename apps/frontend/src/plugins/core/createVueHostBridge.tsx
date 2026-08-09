/**
 * Host 侧 Vue 桥：PluginHostPage 只渲染 React `default`。
 * Host **不依赖 vue**——Vue Remote 自己 createApp，expose 导出 mount(el, bridge)。
 */
import {
	type ComponentType,
	createElement,
	useEffect,
	useLayoutEffect,
	useRef,
} from 'react';
import type { HostBridgeProps } from './types';

/** Vue 根组件 props：Remote 在 mount 内对 bridge 做 reactive */
export type VuePluginRootProps = {
	bridge: HostBridgeProps;
};

/** Remote mount 返回的卸载函数 */
export type VueRemoteDisposer = () => void;

/** Remote mount：挂到 el，可返回 disposer；Host 会把同一 bridge 对象上的字段热更新 */
export type VueRemoteMount = (
	el: HTMLElement,
	bridge: HostBridgeProps,
) => VueRemoteDisposer | undefined;

export type VueRemoteExpose =
	| VueRemoteMount
	| { mount: VueRemoteMount; unmount?: () => void };

function resolveMount(expose: unknown, pluginId: string): VueRemoteMount {
	if (typeof expose === 'function') return expose as VueRemoteMount;
	if (
		expose &&
		typeof expose === 'object' &&
		typeof (expose as { mount?: unknown }).mount === 'function'
	) {
		return (expose as { mount: VueRemoteMount }).mount;
	}
	throw new Error(
		`plugin ${pluginId}: framework "vue" 须 default 导出 mount(el, bridge) 或 { mount }（Host 不内置 Vue，勿直接 export SFC）`,
	);
}

/**
 * 把 Vue Remote 的 mount 包成 Host 可用的 React 组件。
 * registry `framework: 'vue'`；Remote 勿自建 React 桥、勿让 Host 安装 vue。
 */
export function createVueHostBridge(
	expose: VueRemoteExpose,
	pluginId = 'unknown',
): ComponentType<HostBridgeProps> {
	const mount = resolveMount(expose, pluginId);

	function VueHostBridge(props: HostBridgeProps) {
		const elRef = useRef<HTMLDivElement | null>(null);
		// 可变 bag：Remote 侧 reactive(bridge) 后可收到 api/locale 热更新
		const bridgeRef = useRef<HostBridgeProps>({
			api: props.api,
			plugin: props.plugin,
		});

		useEffect(() => {
			bridgeRef.current.api = props.api;
			bridgeRef.current.plugin = props.plugin;
		}, [props.api, props.plugin]);

		// useLayoutEffect：排在父级 attachPluginStyleIsolation 之后、paint 之前，
		// 避免 Element Plus onBeforeMount 建 popper 容器时 Portal 桥尚未就绪。
		// ponytail: 空 deps——mount 一次；SFC HMR 由 Remote 自有 Vue runtime 处理
		useLayoutEffect(() => {
			const el = elRef.current;
			if (!el) return;

			const dispose = mount(el, bridgeRef.current);
			const explicitUnmount =
				typeof expose === 'object' && expose && 'unmount' in expose
					? expose.unmount
					: undefined;

			return () => {
				if (typeof dispose === 'function') dispose();
				else explicitUnmount?.();
			};
		}, []);

		return createElement('div', {
			ref: elRef,
			className: 'h-full w-full min-h-0',
			'data-plugin-root': true,
			'data-mf-framework': 'vue',
		});
	}

	VueHostBridge.displayName = 'VueHostBridge';
	return VueHostBridge;
}
