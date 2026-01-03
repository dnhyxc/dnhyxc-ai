import { MoonStar, Settings, Sun } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTheme } from '@/hooks';

interface Iprops {
	actions?: boolean;
	ccustomActions?: React.ReactNode;
}

const Header: React.FC<Iprops> = ({ actions = true, ccustomActions }) => {
	const { currentTheme, toggleTheme } = useTheme();

	const navigate = useNavigate();

	const toSetting = () => {
		navigate('/setting');
	};

	return (
		<header
			data-tauri-drag-region
			className="h-13 flex items-start pl-[16px] pr-[9px] select-none align-middle"
		>
			<div
				data-tauri-drag-region
				className="w-full h-full flex items-center justify-between"
			>
				<div
					data-tauri-drag-region
					className="text-[24px] font-bold font-['手札体-简'] cursor-default bg-clip-text text-transparent bg-linear-to-r from-[#ff7b00] via-[#ff9900] to-[#ffb700]"
				>
					dnhyxc-ai
				</div>
				{actions ? (
					<div data-tauri-drag-region className="flex items-center h-full">
						{
							<div className="flex items-center h-full">
								{currentTheme === 'light' ? (
									<div
										className="h-full w-8 flex justify-center items-center hover:text-green-600 cursor-pointer"
										onClick={toggleTheme}
									>
										<Sun className="w-5 h-5" />
									</div>
								) : (
									<div
										className="h-full w-8 flex justify-center items-center hover:text-green-600 cursor-pointer"
										onClick={toggleTheme}
									>
										<MoonStar className="w-5 h-5" />
									</div>
								)}
								<div
									className="h-full w-8 flex justify-center items-center hover:text-green-600 cursor-pointer"
									onClick={toSetting}
								>
									<Settings className="w-5 h-5" />
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
