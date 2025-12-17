// import { app } from '@tauri-apps/api';
// import { defaultWindowIcon } from '@tauri-apps/api/app';
// import { Menu } from '@tauri-apps/api/menu';
// import { TrayIcon } from '@tauri-apps/api/tray';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/router';
import './index.css';

// const menu = await Menu.new({
// 	items: [
// 		{
// 			id: 'quit',
// 			text: 'Quit',
// 			action: async () => {
// 				await app.hide();
// 			},
// 		},
// 		{
// 			id: 'show',
// 			text: 'Show',
// 			action: async () => {
// 				await app.show();
// 			},
// 		},
// 	],
// });

// const options = {
// 	// 你可以在这里添加一个托盘菜单、标题、任务提示、事件处理程序等等
// 	icon: (await defaultWindowIcon()) || 'icon.png',
// 	tooltip: 'dnhyxc-ai',
// 	menu,
// 	menuOnLeftClick: true,
// 	menuOnRightClick: true,
// };

// const tray = await TrayIcon.new(options);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
