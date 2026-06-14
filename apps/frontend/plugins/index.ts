import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Connect, Plugin, ResolvedConfig } from 'vite';

const PDFJS_MIME: Record<string, string> = {
	'.wasm': 'application/wasm',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.bcmap': 'application/octet-stream',
};

function copyPdfjsDir(
	configRoot: string,
	subdir: 'wasm' | 'cmaps',
	publicSubdir: string,
) {
	const require = createRequire(path.join(configRoot, 'package.json'));
	const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
	const src = path.join(pdfjsRoot, subdir);
	const dest = path.join(configRoot, 'public', publicSubdir);
	if (!fs.existsSync(src)) return;
	fs.mkdirSync(dest, { recursive: true });
	fs.cpSync(src, dest, { recursive: true, force: true });
}

function pdfjsStaticMiddleware(
	urlPrefix: string,
	rootDir: string,
): Connect.NextHandleFunction {
	return (req, res, next) => {
		const raw = req.url?.split('?')[0] ?? '';
		if (!raw.startsWith(urlPrefix)) return next();
		const rel = decodeURIComponent(raw.slice(urlPrefix.length));
		if (!rel || rel.includes('..')) return next();
		const filePath = path.join(rootDir, rel);
		if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
			return next();
		}
		const ext = path.extname(filePath);
		res.setHeader(
			'Content-Type',
			PDFJS_MIME[ext] ?? 'application/octet-stream',
		);
		fs.createReadStream(filePath).pipe(res);
	};
}

/**
 * pdf.js v6 解码 JBIG2 等需 wasm/cmaps：
 * - 开发：中间件直接从 node_modules 提供（不依赖 public 热更新）
 * - 构建：复制到 public，随 dist 分发
 */
export function copyPdfjsAssetsPlugin(): Plugin {
	let configRoot = '';
	let wasmDir = '';
	let cmapsDir = '';

	return {
		name: 'copy-pdfjs-assets',
		enforce: 'pre',
		configResolved(config: ResolvedConfig) {
			configRoot = config.root;
			const require = createRequire(path.join(config.root, 'package.json'));
			const pdfjsRoot = path.dirname(
				require.resolve('pdfjs-dist/package.json'),
			);
			wasmDir = path.join(pdfjsRoot, 'wasm');
			cmapsDir = path.join(pdfjsRoot, 'cmaps');
		},
		configureServer(server) {
			server.middlewares.use(pdfjsStaticMiddleware('/pdfjs-wasm/', wasmDir));
			server.middlewares.use(pdfjsStaticMiddleware('/pdfjs-cmaps/', cmapsDir));
		},
		configurePreviewServer(server) {
			server.middlewares.use(pdfjsStaticMiddleware('/pdfjs-wasm/', wasmDir));
			server.middlewares.use(pdfjsStaticMiddleware('/pdfjs-cmaps/', cmapsDir));
		},
		buildStart() {
			if (!configRoot) return;
			copyPdfjsDir(configRoot, 'wasm', 'pdfjs-wasm');
			copyPdfjsDir(configRoot, 'cmaps', 'pdfjs-cmaps');
		},
	};
}

export function removeDistMinMapsPlugin(): Plugin {
	let resolvedOutDir = '';

	return {
		name: 'remove-dist-min-maps',
		apply: 'build',
		/**
		 * 说明：打包产物里会出现一个空的 `dist/min-maps/`（通常只包含空 `vs/`），
		 * 当前工程不使用该目录，且它会污染最终分发包体结构。
		 *
		 * 策略：在 bundle 写盘完成后删除该目录（不影响 sourcemap 与运行时）。
		 */
		configResolved(config: ResolvedConfig) {
			// 记录实际 outDir，兼容未来改动 build.outDir
			resolvedOutDir = path.resolve(config.root, config.build.outDir ?? 'dist');
		},
		closeBundle() {
			if (!resolvedOutDir) return;
			const dir = path.join(resolvedOutDir, 'min-maps');
			try {
				if (fs.existsSync(dir)) {
					fs.rmSync(dir, { recursive: true, force: true });
				}
			} catch {
				// 忽略：删除失败不应阻塞构建
			}
		},
	};
}
