type Listener = () => void;

/** 泛型路由注入器；Host 自行定义 TRoute（如本仓 RouteConfig） */
export class RouteInjector<
	TRoute extends { path?: string } = { path?: string },
> {
	private byPlugin = new Map<string, TRoute[]>();
	private listeners = new Set<Listener>();

	inject(pluginId: string, routes: TRoute[]) {
		const prev = this.byPlugin.get(pluginId);
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

	getRoutes(): TRoute[] {
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

export function createRouteInjector<
	TRoute extends { path?: string } = { path?: string },
>() {
	return new RouteInjector<TRoute>();
}
