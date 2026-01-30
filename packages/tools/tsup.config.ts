import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/index.ts'],
	format: ['esm', 'cjs'],
	dts: true,
	splitting: false,
	sourcemap: false,
	clean: false,
	treeshake: true,
	noExternal: ['highlight.js', 'markdown-it', 'markdown-it-katex', 'katex'],
});
