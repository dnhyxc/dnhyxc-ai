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
	WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';
import { useUserInfo } from '@/hooks';
import { removeStorage } from '@/utils';
import { MENUS } from './enum';

const Sidebar = () => {
	const navigate = useNavigate();
	const { userInfo } = useUserInfo();

	const onJump = (path: string) => {
		navigate(path);
	};

	const iconMap = {
		House: <House />,
		BookOpenText: <BookOpenText />,
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
						className="flex justify-center items-center w-11 h-11 bg-border cursor-pointer mb-8 rounded-md hover:text-green-600 transition-all duration-200 ease-in-out"
						onClick={() => onJump('/')}
					>
						<img
							src={userInfo?.profile?.avatar || ICON}
							alt=""
							className={`${userInfo?.profile?.avatar ? 'rounded-md w-10.5 h-10.5 object-cover' : 'w-9.5 h-9.5 cursor-pointer'}`}
						/>
					</div>
					{processedMenus.map((item) => (
						<div
							key={item.path}
							className="flex justify-center items-center w-11 h-11 bg-border mb-4 cursor-pointer rounded-md hover:text-green-600 transition-all duration-200 ease-in-out"
							onClick={item.onClick}
						>
							{item.icon}
						</div>
					))}
				</div>
				<div>
					{userInfo?.access_token ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<div className="flex justify-center items-center w-11 h-11 bg-border cursor-pointer rounded-md hover:text-green-600 transition-all duration-200 ease-in-out">
									<CircleUserRound className="hover:text-green-600" />
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="min-w-26">
								<DropdownMenuLabel className="flex flex-col justify-center items-center">
									<div
										data-tauri-drag-region
										className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer rounded-md hover:text-green-600 transition-all duration-200 ease-in-out"
									>
										<img
											src={userInfo?.profile?.avatar || ICON}
											alt=""
											className={`${userInfo?.profile?.avatar ? 'rounded-md w-11 h-11 object-cover' : 'w-10 h-10 cursor-pointer'}`}
										/>
									</div>
									<div className="mt-2 font-bold text-lg">
										<div>{userInfo?.username}</div>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuItem
									className="flex justify-center items-center cursor-pointer"
									onClick={() => onJump('/profile')}
								>
									<CircleUserRound className="hover:text-green-600" />
									我的主页
								</DropdownMenuItem>
								<DropdownMenuItem
									className="flex justify-center items-center cursor-pointer"
									onClick={onLogout}
								>
									<LogOut className="hover:text-green-600" />
									退出登录
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<div
							className="flex justify-center items-center w-11 h-11 bg-border cursor-pointer rounded-md hover:text-green-600 transition-all duration-200 ease-in-out"
							onClick={() => onJump('/login')}
						>
							<CircleUserRound className="hover:text-green-600" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
