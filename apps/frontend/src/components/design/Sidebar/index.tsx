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
	CreditCard,
	House,
	LogOut,
	Package,
	WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';
import { useStorageInfo } from '@/hooks';
import useStore from '@/store';
import { removeStorage } from '@/utils';
import Image from '../Image';
import { MENUS } from './enum';

const Sidebar = () => {
	const navigate = useNavigate();
	const { userStore } = useStore();
	const { storageInfo } = useStorageInfo();

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
		CreditCard: <CreditCard />,
	};

	const processedMenus = MENUS.map((menu) => ({
		...menu,
		icon: iconMap[menu.icon as keyof typeof iconMap],
		onClick: () => onJump(menu.path),
	}));

	const onLogout = () => {
		removeStorage('token');
		userStore.clearUserInfo();
		navigate('/login');
	};

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
							src={storageInfo?.profile?.avatar}
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
							className="sidebar-nav-btn group text-theme mb-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-theme-secondary transition-[color,background-color] duration-200 ease-linear hover:bg-theme/12 hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
							onClick={item.onClick}
						>
							<span className="flex size-full items-center justify-center [&>svg]:size-[22px] [&>svg]:shrink-0 [&>svg]:overflow-visible">
								{item.icon}
							</span>
						</div>
					))}
				</div>
				<div>
					{storageInfo?.access_token ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<div className="sidebar-nav-btn group text-theme flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-theme-secondary transition-[color,background-color] duration-200 ease-linear hover:bg-theme/12 hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50">
									<CircleUserRound className="size-[22px] shrink-0 overflow-visible" />
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
										className="flex justify-center items-center w-12 h-12 bg-theme-secondary cursor-pointer rounded-md hover:text-teal-500 transition-all duration-200 ease-in-out"
									>
										<img
											src={storageInfo?.profile?.avatar || ICON}
											alt=""
											className={`${storageInfo?.profile?.avatar ? 'rounded-md w-11 h-11 object-cover' : 'w-10 h-10 cursor-pointer'}`}
										/>
									</div>
									<div className="mt-2 font-bold text-lg">
										<div>{storageInfo?.username}</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuItem
									className="text-textcolor focus:text-theme flex justify-center items-center cursor-pointer group"
									onClick={() => onJump('/profile')}
								>
									<CircleUserRound className="text-textcolor group-hover:text-theme" />
									我的主页
								</DropdownMenuItem>
								<DropdownMenuItem
									className="text-textcolor focus:text-theme flex justify-center items-center cursor-pointer group"
									onClick={onLogout}
								>
									<LogOut className="text-textcolor group-hover:text-theme" />
									退出登录
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<div
							role="button"
							tabIndex={0}
							className="sidebar-nav-btn group text-theme flex h-11 w-11 cursor-pointer items-center justify-center rounded-md bg-theme-secondary transition-[color,background-color] duration-200 ease-linear hover:bg-theme/12 hover:text-teal-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50"
							onClick={() => onJump('/login')}
						>
							<CircleUserRound className="size-[22px] shrink-0 overflow-visible" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
