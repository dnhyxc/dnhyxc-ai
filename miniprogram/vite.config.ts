import uni from '@dcloudio/vite-plugin-uni';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [uni()],
	css: {
		preprocessorOptions: {
			scss: {
				additionalData: `@import "@/styles/variables.scss";`,
			},
		},
	},
});
