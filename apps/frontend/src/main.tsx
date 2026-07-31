import ReactDOM from 'react-dom/client';

const el = document.getElementById('root') as HTMLElement;
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isAboutWindow = path === '/about';

// 关于窗只拉轻量 chunk，避免冷启整站路由/插件
if (isAboutWindow) {
	void import('./about').then((m) => m.mount(el));
} else {
	void import('./router').then((m) => {
		ReactDOM.createRoot(el).render(<m.default />);
	});
}
