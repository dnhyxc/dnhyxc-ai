import { Toaster } from '@ui/sonner';
import { useEffect } from 'react';
import { createBrowserRouter, RouteObject } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { clipboard, getValue, onCreateWindow, removeStorage } from '@/utils';
import { http } from '@/utils/fetch';
import { isTauriRuntime } from '@/utils/runtime';
import routes from './routes';

const App = () => {
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
					title: '关于 dnhyxc-ai',
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

		document.addEventListener('keydown', clipboard);

		return () => {
			cancelled = true;
			for (const u of unlistenFns) {
				u();
			}
			document.removeEventListener('keydown', clipboard);
		};
	}, []);

	const router = createBrowserRouter(routes as RouteObject[]);
	return (
		<div className="h-full w-full bg-theme-background">
			<Toaster />
			<RouterProvider router={router} />
		</div>
	);
};

export default App;
