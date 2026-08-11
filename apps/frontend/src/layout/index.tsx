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
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ChatCoreProvider } from '@/contexts';
import {
	getAppFullscreen,
	setAppFullscreen,
	subscribeAppFullscreen,
} from '@/federation';
import { useI18n, useTheme } from '@/hooks';
import { cn } from '@/lib/utils';
import { hasValidAuthToken, requiresAuthForPath } from '@/router/authPaths';
import { formatRoutePageLabel } from '@/router/routeMeta';
import { isTauriRuntime } from '@/utils/runtime';

const Layout = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { t, locale } = useI18n();
	/** 避免 React Strict Mode 或依赖抖动导致同一次拦截连续弹出多条 Toast */
	const authRedirectToastShownRef = useRef(false);
	const [theater, setTheater] = useState(getAppFullscreen);

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
				message: t('route.guard.needLoginMessage', {
					page: formatRoutePageLabel(location.pathname, t, locale),
				}),
			});
		}
		navigate('/login', {
			replace: true,
			state: { from: `${location.pathname}${location.search}` },
		});
	}, [
		needAuth,
		authed,
		location.pathname,
		location.search,
		navigate,
		t,
		locale,
	]);

	useEffect(() => subscribeAppFullscreen(setTheater), []);

	// Web：系统 Esc 退出 document 全屏时同步关掉影院态
	useEffect(() => {
		const onFs = () => {
			if (document.fullscreenElement) return;
			if (!getAppFullscreen()) return;
			if (isTauriRuntime()) return;
			void setAppFullscreen(false);
		};
		document.addEventListener('fullscreenchange', onFs);
		return () => document.removeEventListener('fullscreenchange', onFs);
	}, []);

	return (
		<ChatCoreProvider>
			<main
				className={cn(
					'relative flex h-full w-full bg-theme-background',
					theater ? 'rounded-none' : 'rounded-md',
				)}
			>
				{/*
				  裁剪用 overflow-clip，勿用 overflow-hidden：
				  hidden 仍是 scroll container，contenteditable / TipTap 的
				  scrollIntoView、focus 会改其 scrollTop，把 Sidebar/Header 顶出视口
				  （MF 嵌入后笔记编辑器落在此壳内才复现；独立预览顶栏不在壳内）。
				  overflow 不与 rounded 同层，避免废掉路由页内 backdrop-filter。
				*/}
				<div className="relative flex h-full w-full min-w-0 flex-1 overflow-clip">
					{theater ? null : <Sidebar />}
					<TooltipProvider>
						<div
							data-tauri-drag-region
							className={cn(
								'box-border flex h-full w-full min-w-0 max-w-full flex-1 flex-col',
								theater ? 'rounded-none p-0' : 'rounded-md py-7 pr-7',
							)}
						>
							<div
								className={cn(
									'relative h-full w-full min-w-0 max-w-full bg-theme-secondary',
									theater ? 'rounded-none' : 'rounded-md',
								)}
							>
								<div className="relative h-full w-full min-w-0 max-w-full overflow-clip">
									{theater ? null : <Header />}
									<div
										className={cn(
											'box-border min-h-0 min-w-0 w-full max-w-full',
											theater
												? 'h-full overflow-clip'
												: 'h-[calc(100%-3.25rem)] overflow-x-hidden overflow-y-auto',
										)}
									>
										{needAuth && !authed ? null : <Outlet />}
									</div>
								</div>
							</div>
						</div>
					</TooltipProvider>
					{!isTauriRuntime() && !theater ? (
						<footer className="absolute bottom-1 left-0 w-full pr-6.5 text-right text-xs text-textcolor/55">
							<a
								href="https://beian.miit.gov.cn/"
								target="_blank"
								rel="noopener noreferrer"
							>
								浙ICP备2024111222号-1
							</a>
						</footer>
					) : null}
				</div>
			</main>
		</ChatCoreProvider>
	);
};

export default Layout;
