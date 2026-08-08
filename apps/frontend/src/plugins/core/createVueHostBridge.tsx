/**
 * Host 侧 Vue 桥：PluginHostPage 只渲染 React `default`。
 * Vue Remote 导出 SFC / 组件后，由 loadRemoteApp → normalizePluginModule 调用本工厂包装。
 */
import { type ComponentType, createElement, useEffect, useRef } from 'react';
import {
	createApp,
	reactive,
	type App as VueApp,
	type Component as VueComponent,
} from 'vue';
import type { HostBridgeProps } from './types';

/** Vue 根组件 props：Host 注入的 bridge（reactive，可热更新 api/locale） */
export type VuePluginRootProps = {
	bridge: HostBridgeProps;
};

/**
 * 把 Vue 根组件包成 Host 可用的 React 组件。
 * 子应用勿自建 React 桥；registry `framework: 'vue'` 或 expose `export const framework = 'vue'`。
 */
export function createVueHostBridge(
	VueRoot: VueComponent,
): ComponentType<HostBridgeProps> {
	function VueHostBridge(props: HostBridgeProps) {
		const elRef = useRef<HTMLDivElement | null>(null);
		const appRef = useRef<VueApp | null>(null);
		const bridgeRef = useRef(
			reactive({
				api: props.api,
				plugin: props.plugin,
			}) as HostBridgeProps,
		);

		useEffect(() => {
			bridgeRef.current.api = props.api;
			bridgeRef.current.plugin = props.plugin;
		}, [props.api, props.plugin]);

		useEffect(() => {
			const el = elRef.current;
			if (!el) return;

			const app = createApp(VueRoot, {
				bridge: bridgeRef.current,
			});
			app.mount(el);
			appRef.current = app;

			return () => {
				app.unmount();
				appRef.current = null;
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
