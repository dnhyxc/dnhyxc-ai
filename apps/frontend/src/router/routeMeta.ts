import { matchPath } from 'react-router';
import { buildRoutes } from '@/router/buildRoutes';
import { type RouteConfig } from '@/router/routes';

const pathMatches = (pattern: string, pathname: string) =>
	matchPath({ path: pattern, end: true }, pathname) != null;

const metaOf = (route: RouteConfig) =>
	route.meta?.titleKey || route.meta?.title;

const resolveAbsolute = (
	route: RouteConfig,
	parentBase: string,
): string | null => {
	if (route.index) return parentBase || null;
	if (!route.path) return null;
	if (route.path.startsWith('/')) return route.path;
	if (!parentBase) return `/${route.path}`.replace(/\/+/g, '/');
	return `${parentBase.replace(/\/$/, '')}/${route.path}`.replace(/\/+/g, '/');
};

const dedupeAdjacentTitleKeys = (keys: string[]) => {
	const out: string[] = [];
	for (const key of keys) {
		if (out.length > 0 && out[out.length - 1] === key) continue;
		out.push(key);
	}
	return out;
};

/** 从嵌套路由树解析当前 pathname 的 meta 标题链（titleKey 或静态 title） */
export function resolveRoutePageTitleKeys(pathname: string): string[] {
	type Crumb = { titleKey: string; path: string };

	const findBreadcrumbTrail = (
		routeList: RouteConfig[],
		currentPath: string,
		parentBase: string,
		prefix: Crumb[],
	): Crumb[] | null => {
		for (const route of routeList) {
			const absolute = resolveAbsolute(route, parentBase);
			const titleK = metaOf(route);
			const parentCrumb =
				titleK && absolute ? { titleKey: titleK, path: absolute } : null;

			if (route.children?.length) {
				const nextBase = absolute ?? parentBase;
				const extendedPrefix = parentCrumb ? [...prefix, parentCrumb] : prefix;
				const hit = findBreadcrumbTrail(
					route.children,
					currentPath,
					nextBase,
					extendedPrefix,
				);
				if (hit) return hit;
			}

			if (absolute && titleK && pathMatches(absolute, currentPath)) {
				return [...prefix, { titleKey: titleK, path: absolute }];
			}
		}
		return null;
	};

	const findRouteTitle = (
		routeList: RouteConfig[],
		currentPath: string,
		parentBase: string,
	): string | undefined => {
		for (const route of routeList) {
			const absolute = resolveAbsolute(route, parentBase);
			if (absolute && pathMatches(absolute, currentPath)) {
				const m = metaOf(route);
				if (m) return m;
			}
			if (route.children?.length) {
				const nextBase = absolute ?? parentBase;
				const nested = findRouteTitle(route.children, currentPath, nextBase);
				if (nested) return nested;
			}
		}
		return undefined;
	};

	const routes = buildRoutes();
	const rawTrail = findBreadcrumbTrail(routes, pathname, '', []) ?? [];
	const trail = dedupeAdjacentTitleKeys(rawTrail.map((item) => item.titleKey));
	if (trail.length > 0) return trail;

	const single = findRouteTitle(routes, pathname, '');
	return single ? [single] : [];
}

/** 鉴权拦截 Toast：将 titleKey 链格式化为可读页面名 */
export function formatRoutePageLabel(
	pathname: string,
	translate: (key: string) => string,
): string {
	const keys = resolveRoutePageTitleKeys(pathname);
	if (keys.length === 0) return translate('route.guard.unknownPage');
	return keys.map((key) => translate(key)).join(' › ');
}
