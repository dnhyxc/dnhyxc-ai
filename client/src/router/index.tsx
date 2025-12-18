import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { onCreateWindow } from '@/utils';
import routes from './routes';

const App = () => {
	useEffect(() => {
		const aboutPromist = listen('about', (event) => {
			const eventOptions = event.payload as {
				version: string;
			};
			onCreateWindow({
				url: `/about?version=${eventOptions.version}`,
				label: 'about',
				title: '关于 dnhyxc-ai',
				width: 400,
				height: 300,
				titleBarStyle: 'visible',
				hiddenTitle: false,
				resizable: false,
			});
		});
		return () => {
			aboutPromist.then((unlisten) => unlisten());
		};
	}, []);

	const router = createBrowserRouter(routes);
	return <RouterProvider router={router} />;
};

export default App;
