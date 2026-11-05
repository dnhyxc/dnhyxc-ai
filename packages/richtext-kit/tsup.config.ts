import { defineConfig } from 'tsup';

const external = [
	'react',
	'react-dom',
	'react/jsx-runtime',
	'@tiptap/core',
	'@tiptap/react',
	'@tiptap/react/menus',
	'@tiptap/starter-kit',
	'@tiptap/extension-code-block-lowlight',
	'@tiptap/extension-document',
	'@tiptap/extension-highlight',
	'@tiptap/extension-image',
	'@tiptap/extension-list',
	'@tiptap/extension-placeholder',
	'@tiptap/extension-table',
	'@tiptap/extension-text-align',
	'@tiptap/extensions',
	'@tiptap/pm',
	'lowlight',
	'lucide-react',
	'radix-ui',
	'clsx',
	'tailwind-merge',
];

export default defineConfig([
	{
		entry: {
			index: 'src/index.ts',
			'preview/index': 'src/preview-entry.ts',
			'windowed/index': 'src/windowed-entry.ts',
		},
		format: ['esm', 'cjs'],
		dts: true,
		splitting: false,
		sourcemap: false,
		clean: true,
		treeshake: true,
		external,
	},
]);
