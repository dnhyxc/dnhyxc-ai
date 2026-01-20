import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from '@ui/dropdown-menu';
import {
	BookOpenText,
	CircleUserRound,
	House,
	LogOut,
	Newspaper,
	WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';
import { useStorageInfo } from '@/hooks';
import { removeStorage } from '@/utils';
import { MENUS } from './enum';

const Sidebar = () => {
	const navigate = useNavigate();
	const { storageInfo } = useStorageInfo();

	const onJump = (path: string) => {
		navigate(path);
	};

	const iconMap = {
		House: <House />,
		BookOpenText: <BookOpenText />,
		Newspaper: <Newspaper />,
		WalletCards: <WalletCards />,
	};

	const processedMenus = MENUS.map((menu) => ({
		...menu,
		icon: iconMap[menu.icon as keyof typeof iconMap],
		onClick: () => onJump(menu.path),
	}));

	const onLogout = () => {
		removeStorage('token');
		removeStorage('userInfo');
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
						<img
							src={storageInfo?.profile?.avatar || ICON}
							alt=""
							className={`${storageInfo?.profile?.avatar ? 'rounded-md w-10.5 h-10.5 object-cover' : 'w-9.5 h-9.5 cursor-pointer'}`}
						/>
					</div>
					{processedMenus.map((item) => (
						<div
							key={item.path}
							className="text-theme flex justify-center items-center w-11 h-11 bg-theme-secondary mb-4 cursor-pointer rounded-md hover:text-theme/70 transition-all duration-200 ease-in-out"
							onClick={item.onClick}
						>
							{item.icon}
						</div>
					))}
				</div>
				<div>
					{storageInfo?.access_token ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<div className="text-theme flex justify-center items-center w-11 h-11 bg-theme-secondary cursor-pointer rounded-md hover:text-theme/70 transition-all duration-200 ease-in-out">
									<CircleUserRound className="hover:text-theme/70" />
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="min-w-26">
								<DropdownMenuLabel className="flex flex-col justify-center items-center">
									<div
										data-tauri-drag-region
										className="flex justify-center items-center w-12 h-12 bg-theme-secondary cursor-pointer rounded-md hover:text-theme/70 transition-all duration-200 ease-in-out"
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
							className="text-theme flex justify-center items-center w-11 h-11 bg-theme-secondary cursor-pointer rounded-md hover:text-theme/70 transition-all duration-200 ease-in-out"
							onClick={() => onJump('/login')}
						>
							<CircleUserRound className="hover:text-theme/70" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
