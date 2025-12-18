const Header = () => {
	return (
		<header
			data-tauri-drag-region
			className="h-15 flex items-center pt-4 px-5 select-none"
		>
			<div
				data-tauri-drag-region
				className="text-[24px] font-bold font-['手札体-简'] cursor-default bg-clip-text text-transparent bg-linear-to-r from-[#ff7b00] via-[#ff9900] to-[#ffb700]"
			>
				dnhyxc-ai
			</div>
		</header>
	);
};

export default Header;
