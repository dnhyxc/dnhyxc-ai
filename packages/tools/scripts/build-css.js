import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// CSS 文件映射
const cssFiles = [
	{
		varName: 'githubMarkdownCss',
		path: 'node_modules/github-markdown-css/github-markdown.css',
	},
	{ varName: 'katexCss', path: 'node_modules/katex/dist/katex.min.css' },
	{
		varName: 'highlightCss',
		path: 'node_modules/highlight.js/styles/github-dark.min.css',
	},
];

let output = `// 此文件由 scripts/build-css.js 自动生成
// 请勿手动修改

`;

for (const file of cssFiles) {
	const fullPath = resolve(rootDir, file.path);
	try {
		let content = readFileSync(fullPath, 'utf-8');
		// 转义反引号和 ${} 模板字符串
		content = content
			.replace(/\\/g, '\\\\')
			.replace(/`/g, '\\`')
			.replace(/\$\{/g, '\\${');
		output += `export const ${file.varName} = \`${content}\`;\n\n`;
		console.log(`✓ 读取 ${file.varName} (${content.length} 字符)`);
	} catch (error) {
		console.error(`✗ 无法读取 ${file.varName}: ${error.message}`);
		output += `export const ${file.varName} = ''; // 读取失败\n\n`;
	}
}

const outputPath = resolve(rootDir, 'src/styles.ts');
writeFileSync(outputPath, output, 'utf-8');
console.log(`✅ 样式文件已生成: ${outputPath}`);
