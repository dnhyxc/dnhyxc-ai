import ReactDOM from 'react-dom/client';
import { installHostWindowCloseBridge } from './utils/hostWindowClose';
import { bindLucideStrokePathLength } from './utils/lucideStrokePathLength';
import { isTauriRuntime } from './utils/runtime';

const el = document.getElementById('root') as HTMLElement;
const path = window.location.pathname.replace(/\/+$/, '') || '/';
const isAboutWindow = path === '/about';
const isLearningNotesPopout = path === '/english-learning/notes/popout';

// Tauri + dragDropEnabled:false：未 preventDefault 时 WKWebView 会把落盘文件当导航打开。
if (isTauriRuntime()) {
	const blockFileNav = (e: DragEvent) => {
		if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
	};
	window.addEventListener('dragover', blockFileNav);
	window.addEventListener('drop', blockFileNav);
	installHostWindowCloseBridge();
	if (isLearningNotesPopout) {
		void import(
			'./views/englishLearning/notes/useLearningNotesPopoutCloseSave'
		);
	}
}

// 关于窗只拉轻量 chunk，避免冷启整站路由/插件
if (isAboutWindow) {
	void import('./about').then((m) => m.mount(el));
} else {
	bindLucideStrokePathLength();
	void import('./router').then((m) => {
		ReactDOM.createRoot(el).render(<m.default />);
	});
}
