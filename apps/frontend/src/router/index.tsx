import { Toaster } from '@ui/sonner';
import { useEffect, useMemo, useState } from 'react';
import {
	createBrowserRouter,
	type RouteObject,
	RouterProvider,
} from 'react-router';
import { useInputsOnlyTab } from '@/hooks';
import { readWindowChromeThemeSync } from '@/hooks/theme';
import { pluginManager, routeInjector } from '@/plugins';
import {
	attachTauriPlainFieldClipboardShortcuts,
	onCreateWindow,
} from '@/utils';
import { isTauriRuntime } from '@/utils/runtime';
import { performLogout } from './authSession';
import { buildRoutes } from './buildRoutes';

const App = () => {
	useInputsOnlyTab();
	const [routeEpoch, setRouteEpoch] = useState(0);

	useEffect(() => {
		if (import.meta.env.PROD && isTauriRuntime()) {
			// 线上桌面端禁 WebView 系统右键（后退/刷新/检查元素）；仅 preventDefault，不拦截项目自定义菜单
			document.addEventListener('contextmenu', (e) => {
				e.preventDefault();
			});
		}
		const unsub = routeInjector.subscribe(() => {
			setRouteEpoch((n) => n + 1);
		});
		void pluginManager
			.init()
			.then(() => setRouteEpoch((n) => n + 1))
			.catch((e) => console.error('[plugins] init failed', e));
		return unsub;
	}, []);

	const router = useMemo(() => {
		const r = createBrowserRouter(buildRoutes() as RouteObject[]);
		pluginManager.setNavigate((to) => {
			void r.navigate(to);
		});
		return r;
	}, [routeEpoch]);

	useEffect(() => {
		let cancelled = false;
		const unlistenFns: Array<() => void> = [];

		(async () => {
			if (!isTauriRuntime()) {
				return;
			}
			const { listen } = await import('@tauri-apps/api/event');
			const aboutUnlisten = await listen('about', (event) => {
				const eventOptions = event.payload as {
					version: string;
				};
				void onCreateWindow({
					url: `/about?version=${encodeURIComponent(eventOptions.version)}`,
					label: 'about',
					title: 'dnhyxc-ai',
					width: 400,
					height: 300,
					titleBarStyle: 'visible',
					hiddenTitle: false,
					resizable: false,
					// 与主窗配色一致：非 black → light 标题栏（勿传 undefined 以免跟系统深色）
					theme: readWindowChromeThemeSync(),
				});
			});
			const logoutUnlisten = await listen('logout', () => {
				// Tauri File 菜单「退出登录」：需与侧边栏登出一致（清态 + 跳转）
				performLogout((to) => router.navigate(to));
			});
			if (!cancelled) {
				unlistenFns.push(aboutUnlisten, logoutUnlisten);
			} else {
				aboutUnlisten();
				logoutUnlisten();
			}
		})();

		const detachPlainFieldClipboard = attachTauriPlainFieldClipboardShortcuts();

		return () => {
			cancelled = true;
			detachPlainFieldClipboard();
			for (const u of unlistenFns) {
				u();
			}
		};
	}, [router]);

	return (
		<div className="h-full w-full bg-theme-background">
			<Toaster />
			<RouterProvider router={router} />
		</div>
	);
};

export default App;
