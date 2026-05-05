import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
		globals: false,
		// happy-dom 下 KaTeX 仍会打 quirks mode 提示，与功能无关，测试中屏蔽
		onConsoleLog(log, type) {
			if (
				type === 'stderr' &&
				log.includes("KaTeX doesn't work in quirks mode")
			) {
				return false;
			}
		},
	},
});
