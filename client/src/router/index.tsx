import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useEffect } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import routes from './routes';

const App = () => {
	useEffect(() => {
		const aboutPromist = listen('about', (event) => {
			const eventOptions = event.payload as {
				version: string;
				window: string;
			};
			openChildWindow();
			console.log(eventOptions.version, eventOptions);
		});

		return () => {
			aboutPromist.then((unlisten) => unlisten());
		};
	}, []);

	const openChildWindow = async () => {
		const WIDTH = 400;
		const HEIGHT = 300;
		const webview = new WebviewWindow('about', {
			url: '/about',
			width: WIDTH,
			height: HEIGHT,
			minWidth: WIDTH,
			minHeight: HEIGHT,
			resizable: true,
			decorations: true,
			title: 'dnhyxc-ai',
			// hiddenTitle: true,
			// titleBarStyle: 'overlay',
			// theme: 'light', // 不设置将是跟随系统
			// 计算屏幕中心坐标
			x: (screen.width - WIDTH) / 2,
			y: (screen.height - HEIGHT) / 2,
		});
		// since the webview window is created asynchronously,
		// Tauri emits the `tauri://created` and `tauri://error` to notify you of the creation response
		webview.once('tauri://created', function () {
			// webview window successfully created
			console.log('webview window successfully created');
		});
		webview.once('tauri://error', function (e: any) {
			// an error occurred during webview window creation
			console.log('webview window error', e);
		});
	};

	const router = createBrowserRouter(routes);
	return <RouterProvider router={router} />;
};

export default App;
