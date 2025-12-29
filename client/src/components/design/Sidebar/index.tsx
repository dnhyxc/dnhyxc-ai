import { CircleUserRound, House, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';

const Sidebar = () => {
	const navigate = useNavigate();

	const onJump = (path: string) => {
		navigate(path);
	};

	return (
		<div
			data-tauri-drag-region
			className="w-20 h-full flex flex-col items-center py-7 px-2"
		>
			<div className="h-full flex flex-col justify-between">
				<div>
					<div
						data-tauri-drag-region
						className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer mb-8 rounded-md hover:text-green-600 transition-all duration-200 ease-in-out"
						onClick={() => onJump('/')}
					>
						<img src={ICON} alt="" className="w-9 h-9 cursor-pointer mb-1" />
					</div>
					<div
						className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer mb-4 rounded-md hover:shadow-(--shadow-10) hover:text-green-600 transition-all duration-200 ease-in-out"
						onClick={() => onJump('/')}
					>
						<House />
					</div>
					<div
						className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer mb-4 rounded-md hover:shadow-(--shadow-10) hover:text-green-600 transition-all duration-200 ease-in-out"
						onClick={() => onJump('/detail')}
					>
						<WalletCards className="hover:text-green-600" />
					</div>
					<div
						className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer mb-4 rounded-md hover:shadow-(--shadow-10) hover:text-green-600 transition-all duration-200 ease-in-out"
						onClick={() => onJump('/profile')}
					>
						<WalletCards className="hover:text-green-600" />
					</div>
				</div>
				<div className="">
					<div
						className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer rounded-md hover:text-green-600 transition-all duration-200 ease-in-out"
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
