import type { HostCapabilities } from '../config/types';
import { deepFreeze } from '../host-api/deepFreeze';
import { eventBus } from '../host-api/EventBus';
import type { HostBridgeProps, PluginDescriptor } from '../types';

/** 按 permissions ∩ capabilities 组装并密封 */
export function createHostBridge(
	d: PluginDescriptor,
	capabilities: HostCapabilities,
	navigate: (to: string) => void = capabilities.navigate,
): HostBridgeProps {
	const allow = new Set(d.permissions);
	const api: Record<string, unknown> = {
		theme: capabilities.getTheme(),
		locale: capabilities.getLocale(),
		event: {
			on: (event: string, handler: (data?: unknown) => void) =>
				eventBus.on(d.id, event, handler),
			off: (event: string, handler: (data?: unknown) => void) =>
				eventBus.off(d.id, event, handler),
			emit: (event: string, data?: unknown) => eventBus.emit(d.id, event, data),
		},
	};

	if (allow.has('ui:toast') && capabilities.toast) {
		const ui: Record<string, unknown> = {
			showToast: capabilities.toast,
		};
		if (capabilities.setAppFullscreen) {
			ui.setAppFullscreen = capabilities.setAppFullscreen;
		}
		if (capabilities.downloadBlob) {
			ui.downloadBlob = (options: {
				fileName: string;
				data: ArrayBuffer | Uint8Array;
				mimeType?: string;
			}) =>
				capabilities.downloadBlob!({
					...options,
					pluginId: d.id,
				});
		}
		api.ui = Object.freeze(ui);
	}

	if (allow.has('nav:subtree')) {
		api.navigate = (to: string) => {
			if (!to.startsWith(d.routePath)) {
				throw new Error(`NAV_OUT_OF_SCOPE: ${to}`);
			}
			navigate(to);
		};
	}

	if (allow.has('http:plugin-api') && capabilities.http) {
		api.http = Object.freeze({ ...capabilities.http });
	}

	if (capabilities.buildModules) {
		const built = capabilities.buildModules(allow);
		if (built && Object.keys(built).length > 0) {
			api.modules = Object.freeze(built);
		}
	} else {
		const modules: Record<string, unknown> = {};
		const hostMods = capabilities.modules ?? {};
		for (const [key, value] of Object.entries(hostMods)) {
			if (allow.has(`modules:${key}`)) {
				modules[key] = value;
			}
		}
		if (Object.keys(modules).length > 0) {
			api.modules = Object.freeze(modules);
		}
	}

	return deepFreeze({
		api,
		plugin: {
			id: d.id,
			version: d.version,
			routePath: d.routePath,
		},
	}) as HostBridgeProps;
}
