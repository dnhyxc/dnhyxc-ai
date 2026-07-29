import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App
			api={{
				theme: 'light',
				locale: 'zh-CN',
				navigate: () => undefined,
				event: {
					on: () => undefined,
					off: () => undefined,
					emit: () => undefined,
				},
				ui: { showToast: () => undefined },
			}}
			plugin={{ id: 'remoteDemo', version: '1.0.0', routePath: '/remote-demo' }}
		/>
	</StrictMode>,
);
