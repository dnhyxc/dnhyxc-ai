import {
	BookOpenText,
	CircleUserRound,
	House,
	WalletCards,
} from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';
import { getStorage } from '@/utils';
import { MENUS } from './enum';

const Sidebar = () => {
	const navigate = useNavigate();

	const onJump = (path: string) => {
		navigate(path);
	};

	const iconMap = {
		House: <House />,
		BookOpenText: <BookOpenText />,
		WalletCards: <WalletCards />,
	};

	const processedMenus = useMemo(
		() =>
			MENUS.map((menu) => ({
				...menu,
				icon: iconMap[menu.icon as keyof typeof iconMap],
				onClick: () => onJump(menu.path),
			})),
		[],
	);

	const userInfo = useMemo(
		() => JSON.parse(getStorage('userInfo') || '{}'),
		[],
	);

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
						onClick={() => onJump('/profile')}
					>
						<img
							src={userInfo?.profile?.avatar || ICON}
							alt=""
							className={`${userInfo?.profile?.avatar ? 'rounded-md w-10.5 h-10.5' : 'w-7.5 h-7.5 cursor-pointer mb-1'}`}
						/>
						{/* <img
							src={userInfo?.profile?.avatar || ICON}
							alt="avatar"
							className="rounded-md"
						/> */}
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
					<div
						className="flex justify-center items-center w-11 h-11 bg-border cursor-pointer rounded-md hover:text-green-600 transition-all duration-200 ease-in-out"
						onClick={() => onJump('/login')}
					>
						<CircleUserRound className="hover:text-green-600" />
					</div>
				</div>
			</div>
		</div>
	);
};

export default Sidebar;
