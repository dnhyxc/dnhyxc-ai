import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import { ScrollArea } from '@ui/scroll-area';
import {
	ArrowLeftRight,
	CircleUserRound,
	LogOut,
	ShieldUser,
} from 'lucide-react';
import { observer } from 'mobx-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';
import { PluginIcon, sidebarInjector } from '@/federation';
import { useI18n, useStorageInfo } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import { performLogout } from '@/router/authSession';
import { resolveCosUrlForWebDisplay } from '@/utils';
import Image from '../Image';
import { ICON_MAP, MENUS, PLUGINS, type SidebarMenuConfig } from './enum';

const isMenuActive = (path: string, pathname: string) =>
	path === '/'
		? pathname === '/'
		: pathname === path || pathname.startsWith(`${path}/`);

const Sidebar = observer(() => {
	const navigate = useNavigate();
	const { pathname } = useLocation();
	const { storageInfo } = useStorageInfo();
	const { t } = useI18n();
	const [pluginMenus, setPluginMenus] = useState(() => [
		...sidebarInjector.items,
	]);

	useEffect(() => {
		const sync = () => setPluginMenus([...sidebarInjector.items]);
		sync();
		return sidebarInjector.subscribe(sync);
	}, []);

	const onJump = (path: string) => {
		navigate(path);
	};

	const visibleMenus = useMemo(() => {
		const loggedIn = hasValidAuthToken();
		const dynamic: SidebarMenuConfig[] = pluginMenus.map((m) => ({
			nameKey: m.nameKey,
			icon: m.icon,
			path: m.path,
			requiresAuth: m.requiresAuth,
		}));
		return [...MENUS, ...dynamic, ...PLUGINS].filter(
			(menu) => !menu.requiresAuth || loggedIn,
		);
		// storageInfo 变化（登录/登出）时与 token 展示状态对齐并重算菜单
	}, [storageInfo, pluginMenus]);

	const processedMenus = visibleMenus.map((menu) => ({
		...menu,
		icon: ICON_MAP[menu.icon as keyof typeof ICON_MAP] ?? (
			<PluginIcon name={menu.icon} className="size-5.5" />
		),
		onClick: () => onJump(menu.path),
	}));

	const onLogout = () => {
		performLogout((to) => navigate(to));
	};

	const avatarUrl = useMemo(() => {
		return storageInfo?.profile?.avatar
			? resolveCosUrlForWebDisplay(storageInfo?.profile?.avatar)
			: ICON;
	}, [storageInfo?.profile?.avatar]);

	return (
		<div
			data-tauri-drag-region
			className="w-20 h-full flex flex-col items-center py-7 px-2"
		>
			<div className="flex h-full min-h-0 w-full flex-col justify-between">
				<div className="flex min-h-0 flex-1 flex-col items-center overflow-hidden">
					<div
						data-tauri-drag-region
						className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md bg-theme-secondary transition-all duration-200 ease-in-out hover:text-theme/70"
						onClick={() => onJump('/')}
					>
						<Image
							src={avatarUrl}
							fallbackSrc={ICON}
							showOnError
							className={`${storageInfo?.profile?.avatar ? 'rounded-md w-10.5 h-10.5 object-cover' : 'w-9.5 h-9.5 cursor-pointer'}`}
						/>
					</div>
					<div className="my-7.5 flex min-h-0 w-full flex-1 flex-col items-center">
						<ScrollArea
							className="h-full w-full"
							viewportClassName="[&>div]:items-center!"
							scrollbarClassName="hidden absolute right-0 w-1 border-0 py-0"
						>
							{processedMenus.map((item) => {
								const active = isMenuActive(item.path, pathname);
								return (
									<div
										key={item.path}
										role="button"
										tabIndex={0}
										aria-current={active ? 'page' : undefined}
										className={cn(
											'lucide-stroke-draw-hover group mb-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md transition-[color,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50',
											active
												? 'bg-teal-500/15 text-teal-500'
												: 'text-theme bg-theme/10 hover:bg-teal-500/15 hover:text-teal-300',
										)}
										onClick={item.onClick}
									>
										<span
											className={cn(
												'flex size-full items-center justify-center [&>svg]:size-5.5 [&>svg]:shrink-0 [&>svg]:overflow-visible',
												item.nameKey === 'nav.home' && '[&>svg]:size-6',
												item.nameKey === 'nav.chat' && '[&>svg]:size-6',
												item.nameKey === 'nav.plugins' && '[&>svg]:size-6',
											)}
										>
											{item.icon}
										</span>
									</div>
								);
							})}
						</ScrollArea>
					</div>
				</div>
				<div className="flex w-full shrink-0 items-center justify-center">
					{storageInfo?.access_token ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<div
									className={cn(
										'lucide-stroke-draw-hover group flex h-11 w-11 cursor-pointer items-center justify-center rounded-md transition-[color,background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50',
										'bg-theme/10 text-theme hover:bg-teal-500/15 hover:text-teal-300',
									)}
								>
									<ShieldUser className="size-6.5 shrink-0 overflow-visible" />
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								side="right"
								align="end"
								className="min-w-26"
							>
								<DropdownMenuLabel className="flex flex-col justify-center items-center">
									<div
										data-tauri-drag-region
										className="flex justify-center items-center w-12 h-12 bg-theme-white/5 cursor-pointer rounded-md hover:text-teal-400 hover:bg-theme-white/10 transition-all duration-200 ease-in-out"
									>
										<img
											src={avatarUrl || ICON}
											alt=""
											className={`${storageInfo?.profile?.avatar ? 'rounded-md w-11 h-11 object-cover' : 'w-10 h-10 cursor-pointer'}`}
										/>
									</div>
									<div className="mt-2 font-bold text-lg">
										<div>{storageInfo?.username}</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuItem
									className="text-theme focus:text-theme flex justify-between items-center cursor-pointer group"
									onClick={() => onJump('/profile')}
								>
									<CircleUserRound className="text-theme group-hover:text-teal-300" />
									<span className="group-hover:text-teal-300">
										{t('nav.profile')}
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									className="text-theme focus:text-theme flex justify-between items-center cursor-pointer group"
									onClick={() => onJump('/login')}
								>
									<ArrowLeftRight className="text-theme group-hover:text-teal-300" />
									<span className="group-hover:text-teal-300">
										{t('nav.switchAccount')}
									</span>
								</DropdownMenuItem>
								<DropdownMenuItem
									className="min-w-20 text-theme focus:text-theme flex justify-between items-center cursor-pointer group"
									onClick={onLogout}
								>
									<LogOut className="text-theme group-hover:text-teal-300" />
									<span className="group-hover:text-teal-300">
										{t('auth.logout')}
									</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<div
							role="button"
							tabIndex={0}
							className="lucide-stroke-draw-hover group flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-theme-white/5 text-theme transition-[color,background-color] duration-200 ease-out hover:bg-theme-white/10 hover:text-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
							onClick={() => onJump('/login')}
						>
							<CircleUserRound className="size-6 shrink-0 overflow-visible" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
});

export default Sidebar;
