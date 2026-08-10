import type { ComponentType } from 'react';
import {
	createVueHostBridge,
	type VueRemoteExpose,
} from '../bridge/createVueHostBridge';
import type { HostBridgeProps, PluginDescriptor, PluginModule } from '../types';

/** Remote 原始模块：React 组件，或 Vue mount API + framework 标记 */
export type RawRemoteModule = {
	default: unknown;
	framework?: string;
	mfFramework?: string;
	activate?: PluginModule['activate'];
	deactivate?: PluginModule['deactivate'];
};

/** default 上可挂的生命周期（与组件同文件、且不破坏 Fast Refresh） */
type LifecycleCarrier = {
	activate?: PluginModule['activate'];
	deactivate?: PluginModule['deactivate'];
};

/** default 是否为 { mount }（裸 function 易与 React FC 混淆，须显式 framework: vue） */
function looksLikeVueMount(comp: unknown): boolean {
	return (
		!!comp &&
		typeof comp === 'object' &&
		typeof (comp as { mount?: unknown }).mount === 'function'
	);
}

/** registry / expose `framework: 'vue'`，或 default 形如 `{ mount }` */
export function isVueRemoteModule(
	raw: RawRemoteModule,
	meta: PluginDescriptor,
): boolean {
	if (meta.framework === 'vue') return true;
	if (meta.framework === 'react') return false;
	const tag = raw.framework ?? raw.mfFramework;
	if (tag === 'vue') return true;
	if (tag === 'react') return false;
	return looksLikeVueMount(raw.default);
}

/**
 * 解析生命周期：named export 优先，否则读 default 上的静态属性。
 * 后者允许钩子与组件写在同一文件，且模块仍只有 `export default` → Fast Refresh 可热更。
 */
export function pickPluginLifecycle(
	raw: RawRemoteModule,
): Pick<PluginModule, 'activate' | 'deactivate'> {
	const carrier =
		raw.default &&
		(typeof raw.default === 'function' || typeof raw.default === 'object')
			? (raw.default as LifecycleCarrier)
			: undefined;
	return {
		activate:
			typeof raw.activate === 'function'
				? raw.activate
				: typeof carrier?.activate === 'function'
					? carrier.activate
					: undefined,
		deactivate:
			typeof raw.deactivate === 'function'
				? raw.deactivate
				: typeof carrier?.deactivate === 'function'
					? carrier.deactivate
					: undefined,
	};
}

/**
 * 将 loadRemote 原始模块规范为 Host 可用的 PluginModule（Vue mount → React 桥）。
 */
export function normalizePluginModule(
	raw: RawRemoteModule,
	meta: PluginDescriptor,
): PluginModule {
	if (!raw?.default) {
		throw new Error(`plugin ${meta.id}: expose missing default export`);
	}

	const lifecycle = pickPluginLifecycle(raw);

	if (typeof lifecycle.activate !== 'function') {
		console.info(
			`[federation-kit] plugin "${meta.id}": 未导出 activate 生命周期钩子（named export 或 default.activate）`,
		);
	}
	if (typeof lifecycle.deactivate !== 'function') {
		console.info(
			`[federation-kit] plugin "${meta.id}": 未导出 deactivate 生命周期钩子（named export 或 default.deactivate）`,
		);
	}

	if (isVueRemoteModule(raw, meta)) {
		return {
			default: createVueHostBridge(raw.default as VueRemoteExpose, meta.id),
			...lifecycle,
		};
	}

	return {
		default: raw.default as ComponentType<HostBridgeProps>,
		...lifecycle,
	};
}
