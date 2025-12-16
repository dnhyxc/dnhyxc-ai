/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */
import { Outlet } from 'react-router';
import Menu from '@/components/design/Menu';

const Layout = () => {
	return (
		<main className="w-full h-full flex flex-col rounded-lg box-border">
			<header
				data-tauri-drag-region
				className="h-13 flex items-center pt-4 box-border"
			>
				<div className="text-lg">Welcome to dnhyxc-ai</div>
			</header>
			<div className="flex-1 flex-col justify-center items-center p-4 box-border">
				<div className="w-full h-full flex-1 flex-col justify-center items-center">
					<Outlet />
				</div>
			</div>
			<footer className="h-13 flex items-center justify-center box-border">
				<Menu />
			</footer>
		</main>
	);
};

export default Layout;
