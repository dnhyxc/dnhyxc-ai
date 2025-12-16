import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/router';
import './index.css';

const a = '123';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>,
);
