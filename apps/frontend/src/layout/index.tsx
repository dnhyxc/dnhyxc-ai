/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */

import Header from '@design/Header';
import Sidebar from '@design/Sidebar';
import { Toaster } from '@ui/sonner';
import { Outlet } from 'react-router';
import { useTheme } from '@/hooks';

const Layout = () => {
	useTheme();

	return (
		<main className="w-full h-full flex rounded-md overflow-hidden bg-theme-background">
			<Toaster />
			<Sidebar />
			<div
				data-tauri-drag-region
				className={`w-full h-full flex-1 flex-col justify-center items-center box-border px-7 pl-0 py-7 rounded-md`}
			>
				<div className="h-full w-full rounded-md bg-theme-secondary">
					<Header />
					<div className="w-full h-[calc(100%-3.25rem)]">
						<Outlet />
					</div>
				</div>
			</div>
		</main>
	);
};

export default Layout;
