/*
 * @Description: 布局组件
 * @Author: dnhyxc
 * @Date: 2025-12-15 19:25:29
 * @LastEditors: dnhyxc
 * @FilePath: \src\layout\index.tsx
 */

import Header from '@design/Header';
import Loading from '@design/Loading';
import Sidebar from '@design/Sidebar';
import { TooltipProvider } from '@ui/index';
import { Toast } from '@ui/sonner';
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { ChatCoreProvider } from '@/contexts';
import {
	getAppFullscreen,
	installAppFullscreenExitSync,
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

	useEffect(
		() =>
			subscribeAppFullscreen((next) => {
				flushSync(() => setTheater(next));
			}),
		[],
	);

	// Tauri 原生 host://window-fullscreen / Web document：系统退出全屏时立刻收起影院
	useEffect(() => installAppFullscreenExitSync(), []);

	return (
		<ChatCoreProvider>
			<main
				className={cn(
					'relative flex h-full w-full bg-theme-background',
					theater ? 'rounded-none' : 'rounded-md',
				)}
			>
				{/*
				  壳层 overflow-clip；文档被拖选顶歪时靠 #root position:fixed（index.css）钉住视口。
				  路由页滚动交给各自 ScrollArea。overflow 不与 rounded 同层，以免废掉 backdrop-filter。
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
								data-app-layout
								className={cn(
									'relative h-full w-full min-w-0 max-w-full bg-theme-secondary',
									theater ? 'rounded-none' : 'rounded-md',
								)}
							>
								<div className="relative h-full w-full min-w-0 max-w-full overflow-clip">
									{theater ? null : <Header />}
									<div
										className={cn(
											'box-border min-h-0 min-w-0 w-full max-w-full overflow-clip',
											theater ? 'h-full' : 'h-[calc(100%-3.25rem)]',
										)}
									>
										{needAuth && !authed ? null : (
											<Suspense
												fallback={
													<div className="flex h-full w-full min-h-0 items-stretch p-5.5 pt-0">
														<Loading className="bg-theme-background flex h-full w-full items-center justify-center" />
													</div>
												}
											>
												<Outlet />
											</Suspense>
										)}
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
