import { Settings, Shirt } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useStorageInfo } from '@/hooks';
import routes, { type RouteConfig } from '@/router/routes';
import { checkVersion, getValue, removeStorage, setStorage } from '@/utils';

interface Iprops {
	actions?: boolean;
	ccustomActions?: React.ReactNode;
}

const Header: React.FC<Iprops> = ({ actions = true, ccustomActions }) => {
	const [autoUpdate, setAutoUpdate] = useState(false);

	const { storageInfo } = useStorageInfo('autoUpdate');

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
		const findRouteTitle = (
			routes: RouteConfig[],
			pathname: string,
		): string | undefined => {
			for (const route of routes) {
				if (route.path === pathname) {
					return route.meta?.title;
				}
				if (route.children) {
					const childTitle = findRouteTitle(route.children, pathname);
					if (childTitle) return childTitle;
				}
			}
			return routes.find((i) => i.path === '/chat/:id?')?.meta?.title;
		};
		return findRouteTitle(routes, location.pathname);
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
					className="text-xl font-bold font-['手札体-简'] cursor-default bg-clip-text text-transparent bg-linear-to-r from-[#ff7b00] via-[#ff9900] to-[#ffb700]"
				>
					{title || '智能对话'}
				</div>
				{actions ? (
					<div
						data-tauri-drag-region
						className="text-theme flex items-center h-full"
					>
						{
							<div className="flex items-center h-full">
								<div
									className="h-full w-8 flex justify-center items-center hover:text-theme/80 cursor-pointer"
									onClick={() => navigate('/setting/theme')}
								>
									<Shirt className="w-5 h-4.5" />
								</div>
								<div
									className="relative h-full w-8 flex justify-center items-center hover:text-theme/80 cursor-pointer"
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
