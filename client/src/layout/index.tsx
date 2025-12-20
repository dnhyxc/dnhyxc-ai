/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */

import Header from '@design/Header';
import Sidebar from '@design/Sidebar';
import { ScrollArea } from '@ui/scroll-area';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { getStorage, onListen, setBodyClass } from '@/utils';

const Layout = () => {
	const theme = getStorage('theme');

	useEffect(() => {
		setBodyClass(theme as 'light' | 'dark');

		const unlistenThemePromise = onListen('theme', (event: string) => {
			setBodyClass(event);
		});

		return () => {
			unlistenThemePromise.then((unlisten) => unlisten());
		};
	}, [theme]);

	return (
		<main className="w-full h-full flex rounded-md overflow-hidden">
			<Sidebar />
			<div
				data-tauri-drag-region
				className={`w-full h-full flex-1 flex-col justify-center items-center box-border px-7 pl-0 py-7 rounded-md`}
			>
				<div className="h-full w-full rounded-md bg-border">
					{/* <div className="h-full w-full shadow-(--shadow) rounded-sm"> */}
					<Header />
					<ScrollArea className="w-full h-[calc(100%-52px)] flex justify-center items-center box-border rounded-md p-1">
						<div className="w-full h-full">
							<Outlet />
						</div>
					</ScrollArea>
				</div>
			</div>
			{/* <footer className="h-15 flex items-center justify-center box-border">
				<Menu />
			</footer> */}
		</main>
	);
};

export default Layout;
