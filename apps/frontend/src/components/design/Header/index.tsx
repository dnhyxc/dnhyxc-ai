import { ChevronRight, Languages, Settings, Shirt } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useI18n, useStorageInfo } from '@/hooks';
import routes, { type RouteConfig } from '@/router/routes';
import { checkVersion, getValue, removeStorage, setStorage } from '@/utils';

interface Iprops {
	actions?: boolean;
	ccustomActions?: React.ReactNode;
}

/** 顶栏面包屑单项：titleKey 走 i18n，path 为可导航的绝对 pathname */
type HeaderBreadcrumbCrumb = { titleKey: string; path: string };

const Header: React.FC<Iprops> = ({ actions = true, ccustomActions }) => {
	const [autoUpdate, setAutoUpdate] = useState(false);

	const { storageInfo } = useStorageInfo('autoUpdate');
	const { t, toggleLocale } = useI18n();

	useEffect(() => {
		checkUpdate();
	}, []);

	const checkUpdate = async () => {
		const autoUpdate = await getValue('autoUpdate');
		setAutoUpdate(autoUpdate);
		if (autoUpdate) {
			const res = await checkVersion();
			if (res) {
				setStorage(
					'autoUpdate',
					JSON.stringify({
						version: res?.version,
						notes: res?.body,
						date: res?.date,
					}),
				);
			} else {
				removeStorage('autoUpdate');
			}
		}
	};

	const navigate = useNavigate();
	const location = useLocation();

	const { breadcrumbTrail, headerTitleKey } = useMemo(() => {
		const metaOf = (r: RouteConfig) => r.meta?.titleKey || r.meta?.title;

		/** 将当前 route 与父级前缀拼成绝对 pathname（与 React Router 嵌套路由一致） */
		const resolveAbsolute = (
			route: RouteConfig,
			parentBase: string,
		): string | null => {
			if (route.index) {
				return parentBase || null;
			}
			if (!route.path) return null;
			if (route.path.startsWith('/')) {
				return route.path;
			}
			if (!parentBase) {
				return `/${route.path}`.replace(/\/+/g, '/');
			}
			return `${parentBase.replace(/\/$/, '')}/${route.path}`.replace(
				/\/+/g,
				'/',
			);
		};

		const findRouteTitle = (
			routeList: RouteConfig[],
			pathname: string,
			parentBase: string,
		): string | undefined => {
			for (const route of routeList) {
				const absolute = resolveAbsolute(route, parentBase);
				if (absolute === pathname) {
					const m = metaOf(route);
					if (m) return m;
				}
				if (route.children?.length) {
					const nextBase = absolute ?? parentBase;
					const nested = findRouteTitle(route.children, pathname, nextBase);
					if (nested) return nested;
				}
			}
			return undefined;
		};

		/** 相邻两级 meta 标题相同（如 layout 与 index 同 titleKey）时只保留一项 */
		const dedupeAdjacentTitleKeys = (items: HeaderBreadcrumbCrumb[]) => {
			const out: HeaderBreadcrumbCrumb[] = [];
			for (const it of items) {
				if (out.length > 0 && out[out.length - 1].titleKey === it.titleKey) {
					continue;
				}
				out.push(it);
			}
			return out;
		};

		/**
		 * 在嵌套路由树中收集从根到当前 pathname 的 meta 链，用于面包屑。
		 * 策略：先递归子路由再判断当前节点是否精确匹配 pathname，避免父 path 与 index 子 path 相同时误跳过子节点。
		 */
		const findBreadcrumbTrail = (
			routeList: RouteConfig[],
			pathname: string,
			parentBase: string,
			prefix: HeaderBreadcrumbCrumb[],
		): HeaderBreadcrumbCrumb[] | null => {
			for (const route of routeList) {
				const absolute = resolveAbsolute(route, parentBase);
				const titleK = metaOf(route);
				const parentCrumb =
					titleK && absolute
						? ({
								titleKey: titleK,
								path: absolute,
							} satisfies HeaderBreadcrumbCrumb)
						: null;

				if (route.children?.length) {
					const nextBase = absolute ?? parentBase;
					const extendedPrefix = parentCrumb
						? [...prefix, parentCrumb]
						: prefix;
					const hit = findBreadcrumbTrail(
						route.children,
						pathname,
						nextBase,
						extendedPrefix,
					);
					if (hit) return hit;
				}

				if (absolute === pathname && titleK && absolute) {
					return [
						...prefix,
						{
							titleKey: titleK,
							path: absolute,
						} satisfies HeaderBreadcrumbCrumb,
					];
				}
			}
			return null;
		};

		const rawTrail =
			findBreadcrumbTrail(routes, location.pathname, '', []) ?? [];
		const trail = dedupeAdjacentTitleKeys(rawTrail);

		if (trail.length >= 2) {
			return { breadcrumbTrail: trail, headerTitleKey: undefined };
		}
		if (trail.length === 1) {
			return {
				breadcrumbTrail: null,
				headerTitleKey: trail[0].titleKey,
			};
		}

		const single =
			findRouteTitle(routes, location.pathname, '') ??
			routes.find((i) => i.path === '/chat/:id?')?.meta?.title;

		return { breadcrumbTrail: null, headerTitleKey: single };
	}, [location.pathname]);

	const toSetting = () => {
		navigate('/setting');
	};

	return (
		<header
			data-tauri-drag-region
			className="h-13 flex items-start pl-5.5 pr-[15px] select-none align-middle"
			// className="h-13 flex items-start pl-5.5 pr-[15px] select-none align-middle relative after:content-[''] after:absolute after:bottom-0 after:right-0 after:w-full after:h-px after:rounded-tr-none after:bg-linear-to-l after:from-transparent after:via-theme/5 after:to-transparent after:max-w-[100vw]"
		>
			<div
				data-tauri-drag-region
				className="w-full h-full flex items-center justify-between"
			>
				<div
					data-tauri-drag-region
					className="min-w-0 flex-1 text-xl font-bold font-['手札体-简'] text-theme"
				>
					{breadcrumbTrail ? (
						<nav
							aria-label={t('header.breadcrumbNav')}
							className="flex min-w-0 items-center gap-0.5"
						>
							{breadcrumbTrail.map((c, i) => (
								<span
									key={`${c.path}:${c.titleKey}:${i}`}
									className="flex min-w-0 items-center gap-0.5"
								>
									{i > 0 ? (
										<ChevronRight
											className="size-4 shrink-0 opacity-50"
											aria-hidden
										/>
									) : null}
									{i < breadcrumbTrail.length - 1 ? (
										<button
											type="button"
											className="cursor-pointer truncate border-0 bg-transparent p-0 font-['手札体-简'] text-xl font-bold text-theme/80 transition-colors hover:text-theme"
											onClick={() => void navigate(c.path)}
										>
											{t(c.titleKey)}
										</button>
									) : (
										<span className="cursor-default truncate text-theme">
											{t(c.titleKey)}
										</span>
									)}
								</span>
							))}
						</nav>
					) : (
						<div className="cursor-default truncate">
							{headerTitleKey ? t(headerTitleKey) : t('common.appTitle')}
						</div>
					)}
				</div>
				{actions ? (
					<div
						data-tauri-drag-region
						className="text-theme flex items-center h-full"
					>
						{
							<div className="flex items-center h-full">
								<div
									title={t('header.toggleLanguage')}
									className="lucide-stroke-draw-hover h-full w-8 flex cursor-pointer items-center justify-center hover:text-teal-500 [&_svg]:overflow-visible"
									onClick={() => void toggleLocale()}
								>
									<Languages className="w-5 h-4.5" />
								</div>
								<div
									className="lucide-stroke-draw-hover h-full w-8 flex cursor-pointer items-center justify-center hover:text-teal-500 [&_svg]:overflow-visible"
									onClick={() => navigate('/setting/theme')}
								>
									<Shirt className="w-5 h-4.5" />
								</div>
								<div
									className="lucide-stroke-draw-hover relative flex h-full w-8 cursor-pointer items-center justify-center hover:text-teal-500 [&_svg]:overflow-visible"
									onClick={toSetting}
								>
									<Settings className="w-5 h-5" />
									{storageInfo?.version && autoUpdate ? (
										<div className="absolute top-3 right-0 w-2 h-2 bg-rose-600 rounded-md"></div>
									) : null}
								</div>
								{ccustomActions}
							</div>
						}
					</div>
				) : null}
			</div>
		</header>
	);
};

export default Header;
