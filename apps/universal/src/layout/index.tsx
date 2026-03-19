/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */

import Header from '@design/Header';
import { Toaster } from '@ui/sonner';
import { TooltipProvider } from '@ui/tooltip';
import { Outlet } from 'react-router';
import { ChatCoreProvider } from '@/contexts';

const Layout = () => {
	return (
		<ChatCoreProvider>
			<main className="w-full h-full flex rounded-md overflow-hidden">
				<Toaster />
				<TooltipProvider>
					<div
						data-tauri-drag-region
						className={`w-full h-full flex-1 flex-col justify-center items-center box-border px-7 pl-0 rounded-md`}
					>
						<div className="relative h-full w-full rounded-md bg-theme-secondary">
							<Header />
							<div className="w-full h-[calc(100%-3.25rem)]">
								<Outlet />
							</div>
						</div>
					</div>
				</TooltipProvider>
			</main>
		</ChatCoreProvider>
	);
};

export default Layout;
