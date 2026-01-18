import { listen } from '@tauri-apps/api/event';
import { Toaster } from '@ui/sonner';
import { useEffect } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { clipboard, getValue, onCreateWindow, removeStorage } from '@/utils';
import { http } from '@/utils/fetch';
import routes from './routes';

const App = () => {
	useEffect(() => {
		const aboutPromise = listen('about', async (event) => {
			const eventOptions = event.payload as {
				version: string;
			};
			const theme = await getValue('theme');
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

		const logoutPromise = listen('logout', () => {
			removeStorage('token');
			http.setAuthToken('');
		});

		document.addEventListener('keydown', clipboard);

		return () => {
			aboutPromise.then((unlisten) => unlisten());
			logoutPromise.then((unlisten) => unlisten());
			document.removeEventListener('keydown', clipboard);
		};
	}, []);

	const router = createBrowserRouter(routes);
	return (
		<div className="h-full w-full bg-theme-background">
			<Toaster />
			<RouterProvider router={router} />
		</div>
	);
};

export default App;
