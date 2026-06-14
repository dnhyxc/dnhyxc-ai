import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { copyPdfjsAssetsPlugin, removeDistMinMapsPlugin } from './plugins';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const cosProxyTarget = (
		env.VITE_COS_PUBLIC_DOMAIN ||
		env.VITE_QINIU_DOMAIN ||
		'https://example.cos.ap-guangzhou.myqcloud.com'
	).replace(/\/$/, '');

	// 与 VITE_DEV_API_DOMAIN 同源（去掉 /api），避免 API 在 9226 时代理仍指向 9112 导致 ECONNREFUSED → 500
	const devApiProxyTarget = (
		env.VITE_DEV_API_DOMAIN || 'http://localhost:9112/api'
	).replace(/\/api\/?$/, '');

	const cosProxyPrefixRaw = env.VITE_COS_PROXY_PREFIX || '/ext-cos/';
	const cosProxyPathname =
		(cosProxyPrefixRaw.startsWith('/')
			? cosProxyPrefixRaw
			: `/${cosProxyPrefixRaw}`
		).replace(/\/$/, '') || '/ext-cos';

	return {
		plugins: [
			react(),
			tailwindcss(),
			copyPdfjsAssetsPlugin(),
			removeDistMinMapsPlugin(),
		],
		resolve: {
			alias: {
				'@': '/src',
				'@ui': '/src/components/ui',
				'@design': '/src/components/design',
			},
		},
		optimizeDeps: {
			include: [
				'@dnhyxc-ai/markdown-kit/react',
				'mermaid',
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
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				// 聊天附件等 uploads 静态资源（与 main.ts useStaticAssets 路径一致）
				'/images': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				'/files': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				// COS 对象同源代理：/ext-cos/xxx → VITE_COS_PUBLIC_DOMAIN/xxx
				[cosProxyPathname]: {
					target: cosProxyTarget,
					changeOrigin: true,
					rewrite: (path) =>
						path.replace(new RegExp(`^${cosProxyPathname}`), '') || '/',
				},
			},
		},
	};
});
