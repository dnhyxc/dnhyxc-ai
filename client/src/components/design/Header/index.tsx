import { useTheme } from '@/hooks';
import { getStorage } from '@/utils';
import { Button } from '@ui/button';

const Header = () => {
	const { theme = getStorage('theme'), toggleTheme } = useTheme();
	return (
		<header
			data-tauri-drag-region
			className="h-13 flex items-start px-4 pt-2 select-none"
		>
			<div
				data-tauri-drag-region
				className="w-full flex items-center justify-between"
			>
				<div
					data-tauri-drag-region
					className="text-[24px] font-bold font-['手札体-简'] cursor-default bg-clip-text text-transparent bg-linear-to-r from-[#ff7b00] via-[#ff9900] to-[#ffb700]"
				>
					dnhyxc-ai
				</div>
				<div data-tauri-drag-region>
					<Button
						variant="ghost"
						className="cursor-pointer"
						onClick={toggleTheme}
					>
						主题: {theme}
					</Button>
				</div>
			</div>
		</header>
	);
};

export default Header;
