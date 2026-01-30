import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const stylesDir = path.join(distDir, 'styles');

// 确保目录存在
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}
if (!fs.existsSync(stylesDir)) {
	fs.mkdirSync(stylesDir, { recursive: true });
}

// CSS文件映射
const cssFiles = [
	{
		name: 'github-markdown.css',
		source: path.join(
			__dirname,
			'..',
			'node_modules',
			'github-markdown-css',
			'github-markdown.css',
		),
	},
	{
		name: 'katex.min.css',
		source: path.join(
			__dirname,
			'..',
			'node_modules',
			'katex',
			'dist',
			'katex.min.css',
		),
	},
	{
		name: 'github-dark.min.css',
		source: path.join(
			__dirname,
			'..',
			'node_modules',
			'highlight.js',
			'styles',
			'github-dark.min.css',
		),
	},
];

// 复制CSS文件到dist/styles
cssFiles.forEach((file) => {
	try {
		const content = fs.readFileSync(file.source, 'utf-8');
		const destPath = path.join(stylesDir, file.name);
		fs.writeFileSync(destPath, content);
	} catch (error) {
		console.error(`Failed to copy ${file.name}:`, error.message);
	}
});

// 复制KaTeX字体文件
const fontsDir = path.join(stylesDir, 'fonts');
if (!fs.existsSync(fontsDir)) {
	fs.mkdirSync(fontsDir, { recursive: true });
}

const katexFontsSource = path.join(
	__dirname,
	'..',
	'node_modules',
	'katex',
	'dist',
	'fonts',
);
try {
	const fontFiles = fs.readdirSync(katexFontsSource);
	fontFiles.forEach((fontFile) => {
		const sourcePath = path.join(katexFontsSource, fontFile);
		const destPath = path.join(fontsDir, fontFile);
		fs.copyFileSync(sourcePath, destPath);
	});
} catch (error) {
	console.error('Failed to copy KaTeX fonts:', error.message);
}

// 创建合并的样式文件（可选）
const combinedPath = path.join(stylesDir, 'markdown-styles.css');
const combinedContent = cssFiles
	.map((file) => {
		try {
			return fs.readFileSync(file.source, 'utf-8');
		} catch {
			return '';
		}
	})
	.join('\n\n');

// 添加KaTeX间距规则
const katexSpacingRules = `

/* KaTeX spacing rules for better readability */
/* Reset margins for all math elements */
.katex .mord,
.katex .mbin,
.katex .mrel,
.katex .mopen,
.katex .mclose,
.katex .mpunct,
.katex .minner,
.katex .mord.mtight,
.katex .mbin.mtight,
.katex .mrel.mtight {
  margin: 0;
}

/* Add spacing between operators and operands */
/* Binary operator spacing: +, -, ×, etc. */
.katex .mbin {
  margin-left: 0.22em;
  margin-right: 0.22em;
}

/* Relation operator spacing: =, <, >, etc. */
.katex .mrel {
  margin-left: 0.28em;
  margin-right: 0.28em;
}

/* Special handling for equals sign */
.katex .mrel[data-marker="="] {
  margin-left: 0.3em;
  margin-right: 0.3em;
}

/* Ensure numbers stay together (no spacing between .mord elements) */
.katex .mord + .mord {
  margin-left: 0;
  margin-right: 0;
}

/* Add spacing between operators and numbers */
.katex .mord + .mbin,
.katex .mbin + .mord,
.katex .mord + .mrel,
.katex .mrel + .mord {
  /* Use the operator's margin, not adding extra */
}

/* For display mode, slightly increase spacing */
.katex-display .katex .mbin {
  margin-left: 0.25em;
  margin-right: 0.25em;
}

.katex-display .katex .mrel {
  margin-left: 0.32em;
  margin-right: 0.32em;
}

.katex-display .katex .mrel[data-marker="="] {
  margin-left: 0.35em;
  margin-right: 0.35em;
}

/* Debug styles (uncomment if needed) */
/*
.katex .mord { background-color: rgba(255, 0, 0, 0.05); }
.katex .mbin { background-color: rgba(0, 255, 0, 0.05); }
.katex .mrel { background-color: rgba(0, 0, 255, 0.05); }
*/
`;

const finalCombinedContent = combinedContent + katexSpacingRules;
fs.writeFileSync(combinedPath, finalCombinedContent);

// 创建styles.js文件，导出样式路径和内容
const stylesJsPath = path.join(distDir, 'styles.js');
const stylesJsContent = `// Auto-generated styles exports
export const styles = {
  githubMarkdown: './styles/github-markdown.css',
  katex: './styles/katex.min.css',
  highlight: './styles/github-dark.min.css',
  combined: './styles/markdown-styles.css'
};

export const styleUrls = Object.values(styles);

// 样式内容（字符串）
export const styleContents = {
${cssFiles.map((file) => `  ${file.name.replace(/[.-]/g, '_')}: ${JSON.stringify(fs.readFileSync(file.source, 'utf-8'))}`).join(',\n')}
};
`;
fs.writeFileSync(stylesJsPath, stylesJsContent);

// 创建styles.d.ts类型声明文件
const stylesDtsPath = path.join(distDir, 'styles.d.ts');
const stylesDtsContent = `// Type definitions for styles
export declare const styles: {
  githubMarkdown: string;
  katex: string;
  highlight: string;
  combined: string;
};

export declare const styleUrls: string[];

export declare const styleContents: {
  github_markdown_css: string;
  katex_min_css: string;
  github_dark_min_css: string;
};
`;
fs.writeFileSync(stylesDtsPath, stylesDtsContent);

// 创建src/styles.ts文件，用于TypeScript类型和开发环境
const srcStylesPath = path.join(__dirname, '..', 'src', 'styles.ts');
const srcStylesContent = `// Auto-generated styles exports for TypeScript
// This file is generated by scripts/build-css.js

export const styles = {
  githubMarkdown: './styles/github-markdown.css',
  katex: './styles/katex.min.css',
  highlight: './styles/github-dark.min.css',
  combined: './styles/markdown-styles.css',
} as const;

export const styleUrls = Object.values(styles);

export const styleContents = {
  github_markdown_css: ${JSON.stringify(fs.readFileSync(cssFiles[0].source, 'utf-8'))},
  katex_min_css: ${JSON.stringify(fs.readFileSync(cssFiles[1].source, 'utf-8'))},
  github_dark_min_css: ${JSON.stringify(fs.readFileSync(cssFiles[2].source, 'utf-8'))},
} as const;
`;
fs.writeFileSync(srcStylesPath, srcStylesContent);
console.log('🎉🎉🎉 css generated successfully.\n');
