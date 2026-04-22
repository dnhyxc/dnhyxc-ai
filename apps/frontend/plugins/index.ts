import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

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
