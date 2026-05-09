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
import { Toast } from '@ui/sonner';
import { useLayoutEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ChatCoreProvider } from '@/contexts';
import { useI18n, useTheme } from '@/hooks';
import { hasValidAuthToken, requiresAuthForPath } from '@/router/authPaths';
import { isTauriRuntime } from '@/utils/runtime';

const Layout = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { t } = useI18n();
	/** 避免 React Strict Mode 或依赖抖动导致同一次拦截连续弹出多条 Toast */
	const authRedirectToastShownRef = useRef(false);

	useTheme();

	const needAuth = requiresAuthForPath(location.pathname);
	const authed = hasValidAuthToken();

	useLayoutEffect(() => {
		if (authed) {
			authRedirectToastShownRef.current = false;
		}
		if (!needAuth || authed) return;
		if (!authRedirectToastShownRef.current) {
			authRedirectToastShownRef.current = true;
			Toast({
				type: 'warning',
				title: t('route.guard.needLoginTitle'),
			});
		}
		navigate('/login', {
			replace: true,
			state: { from: `${location.pathname}${location.search}` },
		});
	}, [needAuth, authed, location.pathname, location.search, navigate, t]);

	return (
		<ChatCoreProvider>
			<main className="relative w-full h-full flex rounded-md overflow-hidden bg-theme-background">
				<Sidebar />
				<TooltipProvider>
					<div
						data-tauri-drag-region
						className="box-border flex h-full w-full min-w-0 max-w-full flex-1 flex-col rounded-md py-7 pr-7"
					>
						<div className="relative h-full w-full min-w-0 max-w-full rounded-md bg-theme-secondary overflow-hidden">
							<Header />
							<div className="box-border h-[calc(100%-3.25rem)] min-h-0 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto">
								{needAuth && !authed ? null : <Outlet />}
							</div>
						</div>
					</div>
				</TooltipProvider>
				{!isTauriRuntime() ? (
					<footer className="absolute bottom-1 left-0 w-full text-right pr-6.5 text-xs text-textcolor/55">
						<a
							href="https://beian.miit.gov.cn/"
							target="_blank"
							rel="noopener noreferrer"
						>
							浙ICP备2024111222号-1
						</a>
					</footer>
				) : null}
			</main>
		</ChatCoreProvider>
	);
};

export default Layout;
