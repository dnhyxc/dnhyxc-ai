import { useNavigate } from 'react-router';

const Menu = () => {
	const navigate = useNavigate();

	const onJump = (path: string) => {
		navigate(path);
	};

	return (
		<div className="w-full h-full flex flex-col justify-center items-center">
			<div className="w-full h-13 flex items-center justify-center">
				<div
					className="text-lg mr-3 cursor-pointer text-[#069701] hover:text-green-600"
					onClick={() => onJump('/')}
				>
					Home
				</div>
				<div
					className="text-lg cursor-pointer text-[#069701] hover:text-green-600"
					onClick={() => onJump('/detail')}
				>
					Detail
				</div>
			</div>
		</div>
	);
};

export default Menu;
