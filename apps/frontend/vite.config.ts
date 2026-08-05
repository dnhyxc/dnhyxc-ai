import { federation } from '@module-federation/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import {
	clearMfViteDepCachePlugin,
	copyPdfjsAssetsPlugin,
	removeDistMinMapsPlugin,
} from './plugins';

const host = process.env.TAURI_DEV_HOST;

/**
 * Host 需要 federation（shared + getInstance），否则 Remote 共享 React 易挂。
 * 但不能让 optimizeDeps 预打包 react*：否则会写进 virtual:mf:...，重启后解析失败。
 * 见 module-federation/vite#708 / #768。
 */
// 只 exclude react*：exclude react-router 会让其直连 CJS cookie，浏览器报 parse named export 不存在
const MF_SHARED_EXCLUDE = [
	'react',
	'react/jsx-runtime',
	'react/jsx-dev-runtime',
	'react-dom',
	'react-dom/client',
];

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const cosProxyTarget = (
		env.VITE_COS_PUBLIC_DOMAIN ||
		env.VITE_QINIU_DOMAIN ||
		'https://example.cos.ap-guangzhou.myqcloud.com'
	).replace(/\/$/, '');

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
			clearMfViteDepCachePlugin(),
			react(),
			tailwindcss(),
			copyPdfjsAssetsPlugin(),
			removeDistMinMapsPlugin(),
			federation({
				name: 'host',
				filename: 'remoteEntry.js',
				remotes: {},
				// 勿 shared react-router：生产 loadShare 易与 react-router/dom 拆成双实例，
				// 导致 useLocation 找不到 Router context（线上 /plugins 白屏）。Remote 也未共享它。
				shared: {
					react: { singleton: true, requiredVersion: '^19.1.0' },
					'react-dom': { singleton: true, requiredVersion: '^19.1.0' },
				},
				// 默认 html：clientInjected 前会把任意 src/*.ts 包成无 export 的 entry bootstrap
				hostInitInjectLocation: 'entry',
				dts: false,
				dev: {
					remoteHmr: true,
				},
			}),
		],
		resolve: {
			alias: {
				'@': '/src',
				'@ui': '/src/components/ui',
				'@design': '/src/components/design',
			},
			dedupe: ['react', 'react-dom', 'react-router'],
		},
		optimizeDeps: {
			// 禁止把 shared 打进 .vite/deps（否则 deps 里会 import virtual:mf 且常解析失败）
			exclude: MF_SHARED_EXCLUDE,
			include: [
				'@tauri-apps/api/core',
				'@dnhyxc-ai/markdown-kit/react',
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
			cors: true,
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
				'/images': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				'/files': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
				'/remotes': {
					target: devApiProxyTarget,
					changeOrigin: true,
				},
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
