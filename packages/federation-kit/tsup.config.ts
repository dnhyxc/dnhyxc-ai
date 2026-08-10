import { defineConfig } from 'tsup';

const external = [
	'react',
	'react/jsx-runtime',
	'react-dom',
	'@module-federation/enhanced',
	'@module-federation/enhanced/runtime',
];

export default defineConfig([
	{
		entry: {
			index: 'src/index.ts',
			'style-isolation/index': 'src/style-isolation/index.ts',
		},
		format: ['esm', 'cjs'],
		dts: true,
		splitting: false,
		sourcemap: false,
		clean: true,
		treeshake: true,
		external,
	},
	{
		entry: { 'react/index': 'src/react/index.ts' },
		format: ['esm', 'cjs'],
		dts: true,
		splitting: false,
		sourcemap: false,
		clean: false,
		treeshake: true,
		external,
	},
]);
