import { defineConfig } from 'tsup';

export default defineConfig({
	entry: ['src/server.ts'],
	format: ['esm'],
	platform: 'node',
	target: 'node20',
	sourcemap: true,
	clean: true,
	outDir: 'dist',
	banner: {
		js: '#!/usr/bin/env node',
	},
});
