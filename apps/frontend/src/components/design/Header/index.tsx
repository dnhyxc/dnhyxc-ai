import { Languages, Settings, Shirt } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useI18n, useStorageInfo } from '@/hooks';
import routes, { type RouteConfig } from '@/router/routes';
import { checkVersion, getValue, removeStorage, setStorage } from '@/utils';

interface Iprops {
	actions?: boolean;
	ccustomActions?: React.ReactNode;
}

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

	const title = useMemo(() => {
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

		return (
			findRouteTitle(routes, location.pathname, '') ??
			routes.find((i) => i.path === '/chat/:id?')?.meta?.title
		);
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
					className="text-xl font-bold font-['手札体-简'] cursor-default text-theme"
				>
					{title ? t(title) : t('common.appTitle')}
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
										<div className="absolute top-3 right-0 w-2 h-2 bg-red-600 rounded-md"></div>
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
