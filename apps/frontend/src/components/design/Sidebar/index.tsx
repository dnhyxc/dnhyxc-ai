import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import {
	BookOpenText,
	Bot,
	CircleUserRound,
	Codesandbox,
	House,
	LogOut,
	Package,
	SquareArrowRight,
	Vegan,
	WalletCards,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';
import { useI18n, useStorageInfo } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken } from '@/router/authPaths';
import useStore from '@/store';
import { removeStorage, resolveQiniuUrlForWebDisplay } from '@/utils';
import Image from '../Image';
import { MENUS } from './enum';

const Sidebar = () => {
	const navigate = useNavigate();
	const { userStore } = useStore();
	const { storageInfo } = useStorageInfo();
	const { t } = useI18n();

	const onJump = (path: string) => {
		navigate(path);
	};

	const iconMap = {
		House: <House />,
		Package: <Package />,
		Bot: <Bot />,
		Codesandbox: <Codesandbox />,
		BookOpenText: <BookOpenText />,
		WalletCards: <WalletCards />,
		Vegan: <Vegan />,
	};

	const visibleMenus = useMemo(() => {
		const loggedIn = hasValidAuthToken();
		return MENUS.filter((menu) => !menu.requiresAuth || loggedIn);
		// storageInfo 变化（登录/登出）时与 token 展示状态对齐并重算菜单
	}, [storageInfo]);

	const processedMenus = visibleMenus.map((menu) => ({
		...menu,
		icon: iconMap[menu.icon as keyof typeof iconMap],
		onClick: () => onJump(menu.path),
	}));

	const onLogout = () => {
		removeStorage('token');
		userStore.clearUserInfo();
		navigate('/login');
	};

	const avatarUrl = useMemo(() => {
		return storageInfo?.profile?.avatar
			? resolveQiniuUrlForWebDisplay(storageInfo?.profile?.avatar)
			: ICON;
	}, [storageInfo?.profile?.avatar]);

	return (
		<div
			data-tauri-drag-region
			className="w-20 h-full flex flex-col items-center py-7 px-2"
		>
			<div className="h-full flex flex-col justify-between">
				<div className="flex flex-col items-center">
					<div
						data-tauri-drag-region
						className="flex justify-center items-center w-11 h-11 bg-theme-secondary cursor-pointer mb-8 rounded-md hover:text-theme/70 transition-all duration-200 ease-in-out"
						onClick={() => onJump('/')}
					>
						<Image
							src={avatarUrl}
							fallbackSrc={ICON}
							showOnError
							className={`${storageInfo?.profile?.avatar ? 'rounded-md w-10.5 h-10.5 object-cover' : 'w-9.5 h-9.5 cursor-pointer'}`}
						/>
					</div>
					{processedMenus.map((item) => (
						<div
							key={item.path}
							role="button"
							tabIndex={0}
							className="lucide-stroke-draw-hover group text-theme mb-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-theme-secondary transition-[color,background-color] duration-200 ease-linear hover:bg-theme/12 hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
							onClick={item.onClick}
						>
							<span
								className={cn(
									'flex size-full items-center justify-center [&>svg]:size-[22px] [&>svg]:shrink-0 [&>svg]:overflow-visible',
									item.nameKey === 'nav.chat' && '[&>svg]:size-[24px]',
								)}
							>
								{item.icon}
							</span>
						</div>
					))}
				</div>
				{storageInfo?.access_token ? (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<div className="lucide-stroke-draw-hover group text-theme flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-theme-secondary transition-[color,background-color] duration-200 ease-linear hover:bg-theme/12 hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50">
								<CircleUserRound className="size-[22px] shrink-0 overflow-visible" />
							</div>
						</DropdownMenuTrigger>
						<DropdownMenuContent side="right" align="end" className="min-w-26">
							<DropdownMenuLabel className="flex flex-col justify-center items-center">
								<div
									data-tauri-drag-region
									className="flex justify-center items-center w-12 h-12 bg-theme-secondary cursor-pointer rounded-md hover:text-teal-500 transition-all duration-200 ease-in-out"
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
								className="text-textcolor focus:text-theme flex justify-between items-center cursor-pointer group"
								onClick={() => onJump('/profile')}
							>
								<CircleUserRound className="text-textcolor group-hover:text-theme" />
								{t('nav.profile')}
							</DropdownMenuItem>
							<DropdownMenuItem
								className="min-w-20 text-textcolor focus:text-theme flex justify-between items-center cursor-pointer group"
								onClick={onLogout}
							>
								<LogOut className="text-textcolor group-hover:text-theme" />
								{t('auth.logout')}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<div
						role="button"
						tabIndex={0}
						className="lucide-stroke-draw-hover group text-theme flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-theme-secondary transition-[color,background-color] duration-200 ease-linear hover:bg-theme/12 hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
						onClick={() => onJump('/login')}
					>
						<SquareArrowRight className="size-[22px] shrink-0 overflow-visible" />
					</div>
				)}
			</div>
		</div>
	);
};

export default Sidebar;
