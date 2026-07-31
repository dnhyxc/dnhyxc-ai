import ReactDOM from 'react-dom/client';
import About from '@/views/about';

/** 关于子窗专用入口：不加载主应用 router / plugins */
export function mount(el: HTMLElement) {
	ReactDOM.createRoot(el).render(
		<div className="h-full w-full bg-theme-background text-textcolor">
			<About />
		</div>,
	);
}
