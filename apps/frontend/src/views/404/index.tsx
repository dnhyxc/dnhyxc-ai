import { Button } from '@ui/button';
import { useNavigate } from 'react-router';

const NotFound = () => {
	const navigate = useNavigate();
	return (
		<div
			data-tauri-drag-region
			className="w-full h-full flex items-center flex-col justify-center"
		>
			<div className="text-[24px] font-bold font-['手札体-简'] cursor-default bg-clip-text text-transparent bg-linear-to-r from-[#ff7b00] via-[#ff9900] to-[#ffb700]">
				404 Not Found
			</div>
			<div className="mt-5">
				<Button className="cursor-pointer" onClick={() => navigate('/')}>
					返回首页
				</Button>
			</div>
		</div>
	);
};
export default NotFound;
