import type { ComponentType } from 'react';
import { createVueHostBridge } from './createVueHostBridge';
import type { HostBridgeProps, PluginDescriptor, PluginModule } from './types';

/** Remote 原始模块：React 组件，或 Vue 组件 + framework 标记 */
export type RawRemoteModule = {
	default: unknown;
	framework?: string;
	mfFramework?: string;
	activate?: PluginModule['activate'];
	deactivate?: PluginModule['deactivate'];
};

function looksLikeVueComponent(comp: unknown): boolean {
	if (!comp || (typeof comp !== 'object' && typeof comp !== 'function')) {
		return false;
	}
	const c = comp as Record<string, unknown>;
	// React memo / forwardRef
	if ('$$typeof' in c) return false;
	if ('__vccOpts' in c) return true;
	if (typeof c.setup === 'function' || typeof c.render === 'function') {
		return true;
	}
	if (typeof comp === 'function' && '__vccOpts' in (comp as object)) {
		return true;
	}
	return false;
}

/** registry `framework: 'vue'` 或 expose `export const framework = 'vue'`，再辅以组件形态启发式 */
export function isVueRemoteModule(
	raw: RawRemoteModule,
	meta: PluginDescriptor,
): boolean {
	if (meta.framework === 'vue') return true;
	if (meta.framework === 'react') return false;
	const tag = raw.framework ?? raw.mfFramework;
	if (tag === 'vue') return true;
	if (tag === 'react') return false;
	return looksLikeVueComponent(raw.default);
}

/**
 * 将 loadRemote 原始模块规范为 Host 可用的 PluginModule（Vue → React 桥）。
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
			default: createVueHostBridge(
				raw.default as Parameters<typeof createVueHostBridge>[0],
			),
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
