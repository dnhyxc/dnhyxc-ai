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
 * 将 loadRemote 原始模块规范为 Host 可用的 PluginModule（Vue mount → React 桥）。
 */
export function normalizePluginModule(
	raw: RawRemoteModule,
	meta: PluginDescriptor,
): PluginModule {
	if (!raw?.default) {
		throw new Error(`plugin ${meta.id}: expose missing default export`);
	}

	if (isVueRemoteModule(raw, meta)) {
		return {
			default: createVueHostBridge(raw.default as VueRemoteExpose, meta.id),
			activate: raw.activate,
			deactivate: raw.deactivate,
		};
	}

	return {
		default: raw.default as ComponentType<HostBridgeProps>,
		activate: raw.activate,
		deactivate: raw.deactivate,
	};
}
