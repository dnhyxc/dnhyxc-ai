import { ThemeProvider } from 'next-themes';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import AppRouter from '@/router';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<ThemeProvider attribute="class" defaultTheme="light" enableSystem>
			<BrowserRouter>
				<AppRouter />
				<Toaster richColors position="top-right" />
			</BrowserRouter>
		</ThemeProvider>
	</StrictMode>,
);
