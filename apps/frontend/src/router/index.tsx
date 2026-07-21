import { Toaster } from '@ui/sonner';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserRouter, RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { useInputsOnlyTab } from '@/hooks';
import { pluginManager, routeInjector } from '@/plugins';
import {
	attachTauriPlainFieldClipboardShortcuts,
	getValue,
	onCreateWindow,
	removeStorage,
} from '@/utils';
import { http } from '@/utils/fetch';
import { isTauriRuntime } from '@/utils/runtime';
import { buildRoutes } from './buildRoutes';

const App = () => {
	useInputsOnlyTab();
	const [routeEpoch, setRouteEpoch] = useState(0);

	useEffect(() => {
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
			const aboutUnlisten = await listen('about', async (event) => {
				const eventOptions = event.payload as {
					version: string;
				};
				const theme = (await getValue('theme')) as 'light' | 'dark' | undefined;
				onCreateWindow({
					url: `/about?version=${eventOptions.version}`,
					label: 'about',
					title: 'dnhyxc-ai',
					width: 400,
					height: 300,
					titleBarStyle: 'visible',
					hiddenTitle: false,
					resizable: false,
					theme,
				});
			});
			const logoutUnlisten = await listen('logout', () => {
				removeStorage('token');
				http.setAuthToken('');
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
	}, []);

	return (
		<div className="h-full w-full bg-theme-background">
			<Toaster />
			<RouterProvider router={router} />
		</div>
	);
};

export default App;
