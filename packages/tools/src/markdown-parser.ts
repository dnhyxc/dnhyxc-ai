// MarkdownParser.ts
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import markdownItKatex from 'markdown-it-katex';

// 注意：CSS样式不再自动导入，请从 @dnhyxc-ai/tools/dist/styles 导入所需样式
// 例如：import '@dnhyxc-ai/tools/dist/styles/github-markdown.css';

export interface MarkdownParserOptions {
	html?: boolean;
	linkify?: boolean;
	typographer?: boolean;
	breaks?: boolean;
	// 允许自定义包裹的容器类名，默认为 markdown-body
	containerClass?: string;
	// 可选：自定义错误处理函数
	onError?: (error: unknown) => void;
}

class MarkdownParser {
	private md;
	private containerClass: string;
	private onError?: (error: unknown) => void;

	constructor(options: MarkdownParserOptions = {}) {
		this.containerClass = options.containerClass || 'markdown-body';
		this.onError = options.onError;

		this.md = new MarkdownIt({
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
				return '';
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
		if (!text) return '';

		try {
			const rawHtml = this.md.render(text);
			// 关键：自动包裹一层 div，带上类名，让 github-markdown-css 生效
			return `<div class="${this.containerClass}">${rawHtml}</div>`;
		} catch (error) {
			this.onError?.(error);
			// 降级：直接返回原文（仍包裹容器）
			return `<div class="${this.containerClass}">${text}</div>`;
		}
	}
}

export default MarkdownParser;
