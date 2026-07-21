import { routeInjector } from '@/plugins';
import routes, { type RouteConfig } from './routes';

/** 静态壳路由 + PluginManager 注入的动态插件路由 */
export function buildRoutes(): RouteConfig[] {
	const dynamic = routeInjector.getRoutes();
	if (dynamic.length === 0) return routes;

	return routes.map((route, index) => {
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
