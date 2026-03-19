import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig(async () => ({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': '/src',
			'@ui': '/src/components/ui',
			'@design': '/src/components/design',
		},
	},
	optimizeDeps: {
		include: ['monaco-editor'],
	},
	server: {
		port: 9126,
		strictPort: true,
		proxy: {
			'/api': {
				target: 'http://localhost:9112',
				changeOrigin: true,
			},
		},
	},
}));
