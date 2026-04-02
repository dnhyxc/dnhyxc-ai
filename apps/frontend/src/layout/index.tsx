/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */

import Header from '@design/Header';
import Sidebar from '@design/Sidebar';
import { TooltipProvider } from '@ui/index';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { ChatCoreProvider } from '@/contexts';
import { useTheme } from '@/hooks';

const Layout = () => {
	const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

	useTheme();

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			const container = document.querySelector(
				'[data-gradient-container]',
			) as HTMLElement;
			if (!container) return;

			const rect = container.getBoundingClientRect();
			const x = ((e.clientX - rect.left) / rect.width) * 100;
			const y = ((e.clientY - rect.top) / rect.height) * 100;

			setMousePosition({ x, y });
		};

		window.addEventListener('mousemove', handleMouseMove);
		return () => window.removeEventListener('mousemove', handleMouseMove);
	}, []);

	return (
		<ChatCoreProvider>
			<main className="w-full h-full flex rounded-md overflow-hidden bg-theme-background">
				<Sidebar />
				<TooltipProvider>
					<div
						data-tauri-drag-region
						className={`w-full h-full flex-1 flex-col justify-center items-center box-border px-7 pl-0 py-7 rounded-md`}
					>
						<div className="relative h-full w-full rounded-md bg-theme-secondary">
							<div
								data-gradient-container
								className="absolute rounded-md inset-0 overflow-hidden pointer-events-none"
								style={{
									background: `
						radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, var(--theme-light), transparent 25%),
						radial-gradient(circle at 50% 20%, transparent, transparent 20%)
					`,
								}}
							/>
							<Header />
							<div className="box-border min-h-0 w-full h-[calc(100%-3.25rem)] overflow-y-auto overflow-x-hidden">
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
