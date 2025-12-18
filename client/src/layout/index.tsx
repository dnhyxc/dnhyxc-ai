/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */
import { Outlet, useLocation } from 'react-router';
import Menu from '@/components/design/Menu';
import { ScrollArea } from '@/components/ui/scroll-area';

const Layout = () => {
	const location = useLocation();

	console.log(location.pathname);

	return (
		<main className="w-full h-full flex flex-col rounded-lg box-border overflow-hidden">
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
			<div
				className={`h-[calc(100%-120px)] flex-1 flex justify-center items-center box-border px-5 ${
					location.pathname !== '/about' ? 'pb-0' : 'pb-5'
				}`}
			>
				<ScrollArea className="w-full h-full flex justify-center items-center box-border rounded-lg p-1 shadow-(--shadow)">
					<div className="w-full h-full flex-1 flex-col justify-center items-center">
						<Outlet />
					</div>
				</ScrollArea>
			</div>
			{location.pathname !== '/about' && (
				<footer className="h-15 flex items-center justify-center box-border">
					<Menu />
				</footer>
			)}
		</main>
	);
};

export default Layout;
