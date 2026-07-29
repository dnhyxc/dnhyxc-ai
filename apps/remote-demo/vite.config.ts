import fs from 'node:fs';
import path from 'node:path';
import { federation } from '@module-federation/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** MF mf_owner id 递增后 .vite/deps 会失效，serve 时清缓存 */
function clearMfViteDepCache(): Plugin {
	return {
		name: 'clear-mf-vite-dep-cache',
		enforce: 'pre',
		config(config, { command }) {
			if (command !== 'serve') return;
			const root = config.root ? path.resolve(config.root) : process.cwd();
			fs.rmSync(path.join(root, 'node_modules/.vite'), {
				recursive: true,
				force: true,
			});
		},
	};
}

const host = '127.0.0.1';
const port = 9007;
const devOrigin = `http://${host}:${port}`;

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	/** 生产：.env.production 里 VITE_REMOTE_PUBLIC_ORIGIN=https://dnhyxc.cn:9005 */
	const origin = env.VITE_REMOTE_PUBLIC_ORIGIN || devOrigin;
	const reactRefreshHost =
		env.VITE_REACT_REFRESH_HOST || 'http://127.0.0.1:9002';

	return {
		// 与 Host registry entry 一致，避免只绑 ::1 导致 127.0.0.1 连不上
		base: `${origin}/`,
		plugins: [
			clearMfViteDepCache(),
			react({
				reactRefreshHost,
			}),
			federation({
				name: 'remoteDemo',
				filename: 'remoteEntry.js',
				manifest: true,
				exposes: {
					'./App': './src/index.ts',
				},
				shared: {
					react: { singleton: true, requiredVersion: '^19.1.0' },
					'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
				},
				hostInitInjectLocation: 'entry',
				// Ctrl+C 后 dts-plugin IPC 易残留占端口；demo 不需要联邦类型生成
				dts: false,
				dev: {
					remoteHmr: true,
				},
			}),
		],
		// 避免 optimizeDeps 把 react 打进 .vite/deps 并写入 virtual:mf（#708/#768）
		optimizeDeps: {
			exclude: [
				'react',
				'react/jsx-runtime',
				'react/jsx-dev-runtime',
				'react-dom',
				'react-dom/client',
			],
		},
		server: {
			host,
			port,
			strictPort: true,
			origin: devOrigin,
			cors: true,
			headers: {
				'Access-Control-Allow-Origin': '*',
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
			modulePreload: false,
			minify: false,
		},
	};
});
