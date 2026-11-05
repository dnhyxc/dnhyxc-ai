import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const editor = readFileSync(join(root, 'src/styles/editor.css'), 'utf8');
const preview = readFileSync(join(root, 'src/styles/preview.css'), 'utf8');
const tokens = `/* @dnhyxc-ai/richtext-kit theme tokens — override in host */
:root {
	--rtk-text: var(--theme-textcolor, var(--foreground, #111));
	--rtk-border: var(--theme-border, var(--border, #e5e5e5));
	--rtk-bg: var(--theme-background, var(--background, #fff));
	--rtk-accent: var(--theme, #14b8a6);
}
`;

const outDir = join(root, 'dist/styles');
mkdirSync(outDir, { recursive: true });
writeFileSync(
	join(outDir, 'richtext-kit.css'),
	`${tokens}\n${editor}\n${preview}\n`,
);
console.log('wrote dist/styles/richtext-kit.css');
