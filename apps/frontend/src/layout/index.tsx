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
import { useEffect, useLayoutEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ChatCoreProvider } from '@/contexts';
import { useTheme } from '@/hooks';
import { hasValidAuthToken, requiresAuthForPath } from '@/router/authPaths';

/** 距容器中心归一化：中心 0、四角约 1，用于光圈随位置缩放 */
function pointerEdge01(xPct: number, yPct: number) {
	const nx = xPct / 100;
	const ny = yPct / 100;
	return Math.min(1, Math.hypot((nx - 0.5) * 2, (ny - 0.5) * 2) / Math.SQRT2);
}

const Layout = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const [mousePosition, setMousePosition] = useState({
		x: 50,
		y: 50,
		scale: 1,
	});
	const { x, y, scale } = mousePosition;

	useTheme();

	const needAuth = requiresAuthForPath(location.pathname);
	const authed = hasValidAuthToken();

	useLayoutEffect(() => {
		if (!needAuth || authed) return;
		navigate('/login', {
			replace: true,
			state: { from: `${location.pathname}${location.search}` },
		});
	}, [needAuth, authed, location.pathname, location.search, navigate]);

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			const container = document.querySelector(
				'[data-gradient-container]',
			) as HTMLElement;
			if (!container) return;

			const rect = container.getBoundingClientRect();
			if (rect.width < 1 || rect.height < 1) return;

			const xPct = ((e.clientX - rect.left) / rect.width) * 100;
			const yPct = ((e.clientY - rect.top) / rect.height) * 100;
			const edge = pointerEdge01(xPct, yPct);
			/* 靠边略放大；整体系数压低，避免光圈过大 */
			const s = 0.84 + edge * 0.2;

			setMousePosition({ x: xPct, y: yPct, scale: s });
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
						className={`box-border flex h-full w-full min-w-0 max-w-full flex-1 flex-col rounded-md px-7 py-7 pl-0`}
					>
						<div className="relative h-full w-full min-w-0 max-w-full rounded-md bg-theme-secondary">
							<div
								data-gradient-container
								className="absolute rounded-md inset-0 overflow-hidden pointer-events-none will-change-[background,opacity,filter]"
								style={{
									/* 由内到外：正圆；半径乘 scale 随指针距中心变化 */
									background: `
						radial-gradient(circle min(${Math.round(92 * scale)}px, ${(10.5 * scale).toFixed(2)}vmin) at ${x}% ${y}%, color-mix(in oklch, var(--theme-color) var(--theme-pointer-core), transparent) 0%, color-mix(in oklch, var(--theme-color) var(--theme-pointer-core-mid), transparent) 34%, transparent 88%),
						radial-gradient(circle min(${Math.round(228 * scale)}px, ${(26 * scale).toFixed(2)}vmin) at ${x}% ${y}%, color-mix(in oklch, var(--theme-light) 48%, transparent) 0%, color-mix(in oklch, var(--theme-light) 18%, transparent) 45%, transparent 62%),
						radial-gradient(circle min(${Math.round(400 * scale)}px, ${(42 * scale).toFixed(2)}vmin) at ${x}% ${y}%, color-mix(in oklch, var(--theme-light) 32%, transparent) 0%, color-mix(in oklch, var(--theme-light) 10%, transparent) 48%, transparent 72%),
						radial-gradient(circle at 50% 20%, transparent, transparent 20%)
					`,
								}}
							/>
							<Header />
							<div className="box-border h-[calc(100%-3.25rem)] min-h-0 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto">
								{needAuth && !authed ? null : <Outlet />}
							</div>
						</div>
					</div>
				</TooltipProvider>
			</main>
		</ChatCoreProvider>
	);
};

export default Layout;
