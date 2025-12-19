import { useNavigate } from 'react-router';
import ICON from '@/assets/icon.png';

const Sidebar = () => {
	const navigate = useNavigate();

	const onJump = (path: string) => {
		navigate(path);
	};

	return (
		<div className="w-20 h-full flex flex-col items-center pt-7 px-2">
			<div
				data-tauri-drag-region
				className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer mb-8 rounded-md"
				onClick={() => onJump('/')}
			>
				<img src={ICON} alt="" className="w-9 h-9 cursor-pointer mb-1" />
			</div>
			<div
				className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer mb-4 rounded-md"
				onClick={() => onJump('/')}
			>
				H
			</div>
			<div
				className="flex justify-center items-center w-12 h-12 bg-border cursor-pointer mb-4 rounded-md"
				onClick={() => onJump('/detail')}
			>
				D
			</div>
		</div>
	);
};

export default Sidebar;
