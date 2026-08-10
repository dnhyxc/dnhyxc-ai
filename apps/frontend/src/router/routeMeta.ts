import { matchPath } from 'react-router';
import { pickPluginLocaleText } from '@/plugins/core/types/localeText';
import { buildRoutes } from '@/router/buildRoutes';
import { type RouteConfig, type RouteMeta } from '@/router/routes';

const pathMatches = (pattern: string, pathname: string) =>
	matchPath({ path: pattern, end: true }, pathname) != null;

/** 解析路由 meta 展示文案：titleI18n → titleKey(i18n) → title */
export function resolveRouteMetaLabel(
	meta: RouteMeta | undefined,
	locale: string,
	translate: (key: string) => string,
): string | undefined {
	if (!meta) return undefined;
	const fromMap = pickPluginLocaleText(meta.titleI18n, locale);
	if (fromMap) return fromMap;
	if (meta.titleKey) return translate(meta.titleKey);
	if (meta.title) return meta.title;
	return undefined;
}

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

const dedupeAdjacent = (labels: string[]) => {
	const out: string[] = [];
	for (const label of labels) {
		if (out.length > 0 && out[out.length - 1] === label) continue;
		out.push(label);
	}
	return out;
};

/** 从嵌套路由树解析当前 pathname 的已本地化标题链 */
export function resolveRoutePageLabels(
	pathname: string,
	translate: (key: string) => string,
	locale: string,
): string[] {
	type Crumb = { label: string; path: string };

	const labelOf = (route: RouteConfig) =>
		resolveRouteMetaLabel(route.meta, locale, translate);

	const findBreadcrumbTrail = (
		routeList: RouteConfig[],
		currentPath: string,
		parentBase: string,
		prefix: Crumb[],
	): Crumb[] | null => {
		for (const route of routeList) {
			const absolute = resolveAbsolute(route, parentBase);
			const label = labelOf(route);
			const parentCrumb = label && absolute ? { label, path: absolute } : null;

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

			if (absolute && label && pathMatches(absolute, currentPath)) {
				return [...prefix, { label, path: absolute }];
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
				const m = labelOf(route);
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
	const trail = dedupeAdjacent(rawTrail.map((item) => item.label));
	if (trail.length > 0) return trail;

	const single = findRouteTitle(routes, pathname, '');
	return single ? [single] : [];
}

/** @deprecated 使用 resolveRoutePageLabels */
export function resolveRoutePageTitleKeys(pathname: string): string[] {
	return resolveRoutePageLabels(pathname, (k) => k, 'zh-CN');
}

/** 鉴权拦截 Toast：将标题链格式化为可读页面名 */
export function formatRoutePageLabel(
	pathname: string,
	translate: (key: string) => string,
	locale = 'zh-CN',
): string {
	const labels = resolveRoutePageLabels(pathname, translate, locale);
	if (labels.length === 0) return translate('route.guard.unknownPage');
	return labels.join(' › ');
}
