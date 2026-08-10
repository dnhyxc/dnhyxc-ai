import { createElement } from 'react';
import { routeInjector } from '@/federation';
import routes, { type RouteConfig } from './routes';

/** 插件壳未就绪时占住 `*`，避免刷新子项目路径先闪 404 */
function PluginRoutesPending() {
	return createElement('div', {
		className: 'h-full w-full bg-theme-background',
	});
}

/** 静态壳路由 + PluginManager 注入的动态插件路由 */
export function buildRoutes(pluginsReady = true): RouteConfig[] {
	const dynamic = routeInjector.getRoutes();
	const base = pluginsReady
		? routes
		: routes.map((route) =>
				route.path === '*'
					? { ...route, Component: PluginRoutesPending }
					: route,
			);

	if (dynamic.length === 0) return base;

	return base.map((route, index) => {
		// Layout 壳：首条带 children 的路由
		if (index === 0 && route.children) {
			return {
				...route,
				children: [...route.children, ...dynamic],
			};
		}
		return route;
	});
}
