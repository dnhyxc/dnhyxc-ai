import type { RouteConfig } from '@/router/routes';

type Listener = () => void;

class RouteInjectorImpl {
	private byPlugin = new Map<string, RouteConfig[]>();
	private listeners = new Set<Listener>();

	inject(pluginId: string, routes: RouteConfig[]) {
		const prev = this.byPlugin.get(pluginId);
		// 相同 path 不 notify，避免重建 router 导致 PluginHostPage 反复挂载闪烁
		if (
			prev &&
			prev.length === routes.length &&
			prev.every((r, i) => r.path === routes[i]?.path)
		) {
			return;
		}
		this.byPlugin.set(pluginId, routes);
		this.notify();
	}

	remove(pluginId: string) {
		if (!this.byPlugin.delete(pluginId)) return;
		this.notify();
	}

	getRoutes(): RouteConfig[] {
		return [...this.byPlugin.values()].flat();
	}

	subscribe(fn: Listener) {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	}

	private notify() {
		for (const fn of this.listeners) fn();
	}
}

export const routeInjector = new RouteInjectorImpl();
