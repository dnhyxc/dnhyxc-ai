import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, '..', 'dist');
const stylesDir = path.join(distDir, 'styles');
const hljsOutDir = path.join(stylesDir, 'hljs');

// 确保目录存在
if (!fs.existsSync(distDir)) {
	fs.mkdirSync(distDir, { recursive: true });
}
if (!fs.existsSync(stylesDir)) {
	fs.mkdirSync(stylesDir, { recursive: true });
}

/** 与 Markdown 正文、公式相关（不含 highlight.js 代码块配色） */
const baseCssFiles = [
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
];

/** 默认代码高亮主题（与合并包 markdown-styles.css 保持一致，便于向后兼容） */
const defaultHljsThemeFile = 'github-dark.min.css';
const defaultHljsSource = path.join(
	__dirname,
	'..',
	'node_modules',
	'highlight.js',
	'styles',
	defaultHljsThemeFile,
);

// 复制 github-markdown、katex 到 dist/styles
baseCssFiles.forEach((file) => {
	try {
		const content = fs.readFileSync(file.source, 'utf-8');
		const destPath = path.join(stylesDir, file.name);
		fs.writeFileSync(destPath, content);
	} catch (error) {
		console.error(`Failed to copy ${file.name}:`, error.message);
	}
});

// 根目录保留一份默认 hljs（旧路径 ./styles/github-dark.min.css 仍可用）
try {
	fs.writeFileSync(
		path.join(stylesDir, defaultHljsThemeFile),
		fs.readFileSync(defaultHljsSource, 'utf-8'),
	);
} catch (error) {
	console.error(
		`Failed to copy default ${defaultHljsThemeFile}:`,
		error.message,
	);
}

/**
 * 复制 highlight.js 全部 *.min.css 主题到 dist/styles/hljs（含 base16 等子目录）
 * @returns {Record<string, string>} 主题 id -> 相对 dist 包根的路径片段（供 import 子路径）
 */
function copyAllHljsMinThemes() {
	const hljsStylesRoot = path.join(
		__dirname,
		'..',
		'node_modules',
		'highlight.js',
		'styles',
	);
	const themeMap = {};

	if (!fs.existsSync(hljsStylesRoot)) {
		console.error('highlight.js styles directory not found');
		return themeMap;
	}

	fs.mkdirSync(hljsOutDir, { recursive: true });

	function walk(dir, relPosix = '') {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const e of entries) {
			const full = path.join(dir, e.name);
			const rel = relPosix ? `${relPosix}/${e.name}` : e.name;
			if (e.isDirectory()) {
				walk(full, rel.replace(/\\/g, '/'));
			} else if (e.name.endsWith('.min.css')) {
				const dest = path.join(hljsOutDir, rel);
				fs.mkdirSync(path.dirname(dest), { recursive: true });
				fs.copyFileSync(full, dest);
				const id = rel.replace(/\\/g, '/').replace(/\.min\.css$/, '');
				themeMap[id] = `./styles/hljs/${rel.replace(/\\/g, '/')}`;
			}
		}
	}

	walk(hljsStylesRoot);
	return themeMap;
}

const highlightJsThemes = copyAllHljsMinThemes();

// 复制 KaTeX 字体文件
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

// 添加 KaTeX 间距规则（与正文/公式合并文件共用）
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

// 仅正文 + 公式 + 间距，不含 highlight.js（用户自行挑选 @dnhyxc-ai/tools/styles/hljs/* ）
const markdownBaseParts = baseCssFiles.map((file) => {
	try {
		return fs.readFileSync(file.source, 'utf-8');
	} catch {
		return '';
	}
});
const markdownBasePath = path.join(stylesDir, 'markdown-base.css');
fs.writeFileSync(
	markdownBasePath,
	markdownBaseParts.join('\n\n') + katexSpacingRules,
);

// 完整默认：正文 + 公式 + 默认 github-dark + 间距（与历史 markdown-styles.css 行为一致）
const combinedParts = [
	...markdownBaseParts,
	fs.readFileSync(defaultHljsSource, 'utf-8'),
];
const combinedPath = path.join(stylesDir, 'markdown-styles.css');
fs.writeFileSync(combinedPath, combinedParts.join('\n\n') + katexSpacingRules);

const themeIds = Object.keys(highlightJsThemes).sort();
const themesJson = JSON.stringify(highlightJsThemes, null, 2);
const themeIdsJson = JSON.stringify(themeIds);

// 生成 HighlightJsThemeId 联合类型，供 MarkdownParser 等获得完整字面量提示
const generatedDir = path.join(__dirname, '..', 'src', 'generated');
if (!fs.existsSync(generatedDir)) {
	fs.mkdirSync(generatedDir, { recursive: true });
}
const themeIdUnionLines = themeIds
	.map((id) => `  | ${JSON.stringify(id)}`)
	.join('\n');
const generatedThemeIdsPath = path.join(
	generatedDir,
	'highlight-js-theme-ids.ts',
);
fs.writeFileSync(
	generatedThemeIdsPath,
	`/**
 * highlight.js 主题 id（与 dist/styles/hljs 下 *.min.css 对应，不含 .min.css 后缀）
 * 由 scripts/build-mk-css.js 根据 node_modules/highlight.js 扫描生成，请勿手改
 */
export type HighlightJsThemeId =
${themeIdUnionLines};
`,
);

// 创建 styles.js 文件，导出样式路径和内容
const stylesJsPath = path.join(distDir, 'styles.js');
const stylesJsContent = `// Auto-generated styles exports
/** highlight.js 主题 id -> 包内相对路径（用于 import.meta.resolve 或文档中的子路径 import） */
export const highlightJsThemes = ${themesJson};

/** 所有已打包的 highlight.js 主题 id（*.min.css，含 base16/ 等子目录） */
export const highlightJsThemeIds = ${themeIdsJson};

/** 默认代码高亮主题 id，与 markdown-styles.css 内嵌主题一致 */
export const defaultHighlightJsThemeId = ${JSON.stringify(defaultHljsThemeFile.replace(/\.min\.css$/, ''))};

export const styles = {
  githubMarkdown: './styles/github-markdown.css',
  katex: './styles/katex.min.css',
  /** 默认高亮主题（github-dark），与合并包一致 */
  highlight: './styles/github-dark.min.css',
  /** 合并：正文 + 公式 + 默认高亮 + KaTeX 间距 */
  combined: './styles/markdown-styles.css',
  /** 仅正文 + 公式 + KaTeX 间距，不含代码块配色（需另选 highlightJsThemes 之一） */
  markdownBase: './styles/markdown-base.css',
};

export const styleUrls = Object.values(styles);

// 样式内容（字符串）：仅含基础三份中的「非 hljs」与默认 hljs，避免把上百套主题打进 JS
export const styleContents = {
  github_markdown_css: ${JSON.stringify(fs.readFileSync(baseCssFiles[0].source, 'utf-8'))},
  katex_min_css: ${JSON.stringify(fs.readFileSync(baseCssFiles[1].source, 'utf-8'))},
  github_dark_min_css: ${JSON.stringify(fs.readFileSync(defaultHljsSource, 'utf-8'))},
};
`;
fs.writeFileSync(stylesJsPath, stylesJsContent);

// 创建 styles.d.ts 类型声明文件
const stylesDtsPath = path.join(distDir, 'styles.d.ts');
const stylesDtsContent = `// Type definitions for styles
export declare const highlightJsThemes: Record<string, string>;

export declare const highlightJsThemeIds: readonly string[];

export declare const defaultHighlightJsThemeId: string;

export declare const styles: {
  githubMarkdown: string;
  katex: string;
  highlight: string;
  combined: string;
  markdownBase: string;
};

export declare const styleUrls: string[];

export declare const styleContents: {
  github_markdown_css: string;
  katex_min_css: string;
  github_dark_min_css: string;
};
`;
fs.writeFileSync(stylesDtsPath, stylesDtsContent);

// 创建 src/styles.ts 文件，用于 TypeScript 类型和开发环境（tsup 打包）
const srcStylesPath = path.join(__dirname, '..', 'src', 'styles.ts');
const srcStylesContent = `// 由 scripts/build-mk-css.js 生成，请勿手改

/** 与 highlightJsThemeIds 中每一项对应，键含 base16/ 等子路径时用斜杠 */
export const highlightJsThemes: Readonly<Record<string, string>> = ${themesJson};

export const highlightJsThemeIds = ${themeIdsJson} as readonly string[];

export const defaultHighlightJsThemeId = ${JSON.stringify(defaultHljsThemeFile.replace(/\.min\.css$/, ''))};

export const styles = {
  githubMarkdown: './styles/github-markdown.css',
  katex: './styles/katex.min.css',
  highlight: './styles/github-dark.min.css',
  combined: './styles/markdown-styles.css',
  markdownBase: './styles/markdown-base.css',
} as const;

export const styleUrls = Object.values(styles);

export const styleContents = {
  github_markdown_css: ${JSON.stringify(fs.readFileSync(baseCssFiles[0].source, 'utf-8'))},
  katex_min_css: ${JSON.stringify(fs.readFileSync(baseCssFiles[1].source, 'utf-8'))},
  github_dark_min_css: ${JSON.stringify(fs.readFileSync(defaultHljsSource, 'utf-8'))},
} as const;
`;
fs.writeFileSync(srcStylesPath, srcStylesContent);

console.log(
	`🎉 css generated: markdown-base + markdown-styles + ${themeIds.length} hljs themes in styles/hljs/\n`,
);
