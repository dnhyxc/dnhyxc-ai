import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

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
		include: [
			'monaco-editor',
			'prettier/standalone',
			'prettier/plugins/babel',
			'prettier/plugins/estree',
			'prettier/plugins/html',
			'prettier/plugins/markdown',
			'prettier/plugins/postcss',
			'prettier/plugins/typescript',
			'prettier/plugins/yaml',
		],
	},
	server: {
		port: 9002,
		strictPort: true,
		host: '0.0.0.0',
		hmr: host
			? {
					protocol: 'ws',
					host,
					port: 9002,
				}
			: undefined,
		watch: {
			ignored: ['**/src-tauri/**'],
		},
		proxy: {
			'/api': {
				target: 'http://localhost:9112',
				changeOrigin: true,
			},
		},
	},
}));
