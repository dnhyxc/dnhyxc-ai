```ts
// MarkdownParser.ts
import hljs from "highlight.js";
import MarkdownIt from "markdown-it";
import markdownItKatex from "markdown-it-katex";

// 1. 引入 Markdown 基础样式 (包含表格、引用、列表等)
import "github-markdown-css/github-markdown.css";
// 2. 引入 KaTeX 数学公式样式
import "katex/dist/katex.min.css";
// 3. 引入代码高亮样式 (这里选用了 github-dark 主题，你可以换成其他的)
import "highlight.js/styles/github-dark.min.css";
import { Toast } from "@/components/ui";

export interface MarkdownParserOptions {
	html?: boolean;
	linkify?: boolean;
	typographer?: boolean;
	breaks?: boolean;
	// 允许自定义包裹的容器类名，默认为 markdown-body
	containerClass?: string;
}

class MarkdownParser {
	private md;
	private containerClass: string;

	constructor(options: MarkdownParserOptions = {}) {
		this.containerClass = options.containerClass || "markdown-body";

		this.md = new MarkdownIt({
			// MarkdownParser.ts
			// 允许渲染原生 HTML 标签
			html: options.html ?? true,
			// 自动识别并转换 URL 为可点击链接
			linkify: options.linkify ?? true,
			// 启用智能排版，如引号、破折号优化
			typographer: options.typographer ?? true,
			// 将单个换行符转换为 <br> 标签
			breaks: options.breaks ?? true,
			highlight: (str: string, lang: string): string => {
				if (lang && hljs.getLanguage(lang)) {
					try {
						return hljs.highlight(str, { language: lang }).value;
					} catch (__) {}
				}
				return "";
			},
		});

		this.md.use(markdownItKatex, { throwOnError: false, displayMode: false });
	}

	/**
	 * 解析 Markdown 并自动包裹样式容器
	 * @param text Markdown 文本
	 * @returns 带有样式容器的 HTML 字符串
	 */
	public render(text: string): string {
		if (!text) return "";

		try {
			const rawHtml = this.md.render(text);
			// 关键：自动包裹一层 div，带上类名，让 github-markdown-css 生效
			return `<div class="${this.containerClass}">${rawHtml}</div>`;
		} catch (error) {
			Toast({
				type: "error",
				title: `markdown 解析失败: ${String(error)}`,
			});
			return `<div class="${this.containerClass}">${text}</div>`;
		}
	}
}

export default MarkdownParser;
```

```js
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// CSS 文件映射
const cssFiles = [
	{
		varName: "githubMarkdownCss",
		path: "node_modules/github-markdown-css/github-markdown.css",
	},
	{ varName: "katexCss", path: "node_modules/katex/dist/katex.min.css" },
	{
		varName: "highlightCss",
		path: "node_modules/highlight.js/styles/github-dark.min.css",
	},
];

let output = `// 此文件由 scripts/build-css.js 自动生成
// 请勿手动修改

`;

for (const file of cssFiles) {
	const fullPath = resolve(rootDir, file.path);
	try {
		let content = readFileSync(fullPath, "utf-8");
		// 转义反引号和 ${} 模板字符串
		content = content
			.replace(/\\/g, "\\\\")
			.replace(/`/g, "\\`")
			.replace(/\$\{/g, "\\${");
		output += `export const ${file.varName} = \`${content}\`;\n\n`;
		console.log(`✓ 读取 ${file.varName} (${content.length} 字符)`);
	} catch (error) {
		console.error(`✗ 无法读取 ${file.varName}: ${error.message}`);
		output += `export const ${file.varName} = ''; // 读取失败\n\n`;
	}
}

const outputPath = resolve(rootDir, "src/styles.ts");
writeFileSync(outputPath, output, "utf-8");
console.log(`✅ 样式文件已生成: ${outputPath}`);
```
