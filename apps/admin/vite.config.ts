import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const host = '127.0.0.1';
const port = 9003;

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const devApiProxyTarget = (
		env.VITE_DEV_API_DOMAIN || 'http://localhost:9112/api'
	).replace(/\/api\/?$/, '');

	return {
		plugins: [react(), tailwindcss()],
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
				'@ui': path.resolve(__dirname, 'src/components/ui'),
			},
		},
		server: {
			host,
			port,
			strictPort: true,
			cors: true,
			proxy: {
				'/api': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				'/images': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				'/files': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
			},
		},
		preview: {
			host,
			port,
			strictPort: true,
			cors: true,
		},
		build: {
			target: 'esnext',
		},
	};
});
