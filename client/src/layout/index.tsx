/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */
import { Outlet, useLocation } from 'react-router';
import Header from '@/components/design/Header';
import Menu from '@/components/design/Menu';
import { ScrollArea } from '@/components/ui/scroll-area';

const Layout = () => {
	const location = useLocation();

	console.log(location.pathname);

	return (
		<main className="w-full h-full flex flex-col rounded-lg box-border overflow-hidden">
			<Header />
			<div
				className={`h-[calc(100%-120px)] flex-1 flex justify-center items-center box-border px-5`}
			>
				<ScrollArea className="w-full h-full flex justify-center items-center box-border rounded-lg p-1 shadow-(--shadow)">
					<div className="w-full h-full flex-1 flex-col justify-center items-center">
						<Outlet />
					</div>
				</ScrollArea>
			</div>
			<footer className="h-15 flex items-center justify-center box-border">
				<Menu />
			</footer>
		</main>
	);
};

export default Layout;
