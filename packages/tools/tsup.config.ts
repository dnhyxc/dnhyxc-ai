import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: { index: 'src/index.ts' },
		format: ['esm', 'cjs'],
		dts: true,
		splitting: false,
		sourcemap: false,
		clean: false,
		treeshake: true,
		noExternal: ['highlight.js', 'markdown-it', 'markdown-it-katex', 'katex'],
	},
	{
		entry: { 'react/index': 'src/react/index.ts' },
		format: ['esm', 'cjs'],
		dts: true,
		splitting: false,
		sourcemap: false,
		clean: false,
		treeshake: true,
		outDir: 'dist',
		// mermaid 含 Node 侧依赖，不可打进浏览器包；由本包 dependencies 提供安装位置供打包器解析
		external: ['react', 'react/jsx-runtime', 'mermaid'],
	},
]);
