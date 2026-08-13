import Loading from '@design/Loading';
import { Toaster } from '@ui/sonner';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
	createBrowserRouter,
	type RouteObject,
	RouterProvider,
} from 'react-router';
import { mf } from '@/federation';
import { useInputsOnlyTab } from '@/hooks';
import { readWindowChromeThemeSync } from '@/hooks/theme';
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
	/** false 时 catch-all 不渲染 404，等插件壳挂上后再决断 */
	const [pluginsReady, setPluginsReady] = useState(false);

	useEffect(() => {
		if (isTauriRuntime()) {
			document.addEventListener('contextmenu', (e) => {
				e.preventDefault();
			});
		}
		const unsub = mf.onRoutesChange(() => {
			setRouteEpoch((n) => n + 1);
		});
		void mf
			.start()
			.catch((e) => console.error('[federation] start failed', e))
			.finally(() => {
				setPluginsReady(true);
				setRouteEpoch((n) => n + 1);
			});
		return unsub;
	}, []);

	const router = useMemo(() => {
		const r = createBrowserRouter(buildRoutes(pluginsReady) as RouteObject[]);
		mf.setNavigate((to) => {
			void r.navigate(to);
		});
		return r;
	}, [routeEpoch, pluginsReady]);

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
		// data-mf-host-portal：标记 Host 应用根，供 MF 对 ReactDOM.createPortal 的劫持识别。
		// 插件 Portal 桥接会把挂到 body/documentElement 的内容重定向进 [data-mf-portal-scope]，
		// 以便落入 Remote 的 @scope([data-mf-style-realm])；若目标落在本属性子树内则跳过重定向，
		// 保证 Host 自身 UI（如 <Toaster /> / sonner）仍挂在 Host 侧，不被收进插件样式域，
		// 避免 Host 弹层样式被 Remote CSS 污染或误隔离。
		<div className="h-full w-full bg-theme-background" data-mf-host-portal>
			<Toaster />
			{/* Layout 外路由（login/about 等）lazy 也需 Suspense */}
			<Suspense
				fallback={
					<Loading className="flex h-full items-center justify-center" />
				}
			>
				<RouterProvider router={router} />
			</Suspense>
		</div>
	);
};

export default App;
