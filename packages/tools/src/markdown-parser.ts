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

		// Add support for \(...\) and \[...\] delimiters
		this.addLatexDelimiters();
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

	private addLatexDelimiters(): void {
		const md = this.md;

		// Helper function to check if delimiter is valid (similar to markdown-it-katex)
		function isValidDelim(
			state: any,
			pos: number,
		): { can_open: boolean; can_close: boolean } {
			const prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1;
			const nextChar =
				pos + 1 <= state.posMax ? state.src.charCodeAt(pos + 1) : -1;
			let can_open = true;
			let can_close = true;

			// Check non-whitespace conditions for opening and closing
			if (
				prevChar === 0x20 ||
				prevChar === 0x09 ||
				(nextChar >= 0x30 && nextChar <= 0x39)
			) {
				can_close = false;
			}
			if (nextChar === 0x20 || nextChar === 0x09) {
				can_open = false;
			}

			return { can_open, can_close };
		}

		// Inline math with \(...\)
		function mathInlineParens(state: any, silent: boolean): boolean {
			const start = state.pos;
			const src = state.src;

			// Check for \(
			if (
				src.charCodeAt(start) !== 0x5c /* \ */ ||
				src.charCodeAt(start + 1) !== 0x28 /* ( */
			) {
				return false;
			}

			const res = isValidDelim(state, start);
			if (!res.can_open) {
				if (!silent) {
					state.pending += '\\(';
				}
				state.pos += 2;
				return true;
			}

			// Find closing \)
			let pos = start + 2;
			let found = false;
			while (pos < state.src.length) {
				if (src.charCodeAt(pos) === 0x5c && src.charCodeAt(pos + 1) === 0x29) {
					found = true;
					break;
				}
				pos++;
			}

			if (!found) {
				if (!silent) {
					state.pending += '\\(';
				}
				state.pos = start + 2;
				return true;
			}

			// Check if content is empty
			if (pos - (start + 2) === 0) {
				if (!silent) {
					state.pending += '\\()';
				}
				state.pos = start + 3;
				return true;
			}

			const resClose = isValidDelim(state, pos);
			if (!resClose.can_close) {
				if (!silent) {
					state.pending += '\\(';
				}
				state.pos = start + 2;
				return true;
			}

			if (!silent) {
				const token = state.push('math_inline', 'math', 0);
				token.markup = '$';
				token.content = state.src.slice(start + 2, pos);
			}

			state.pos = pos + 2;
			return true;
		}

		// Block math with \[...\]
		function mathBlockBracket(
			state: any,
			startLine: number,
			endLine: number,
			silent: boolean,
		): boolean {
			const start = state.bMarks[startLine] + state.tShift[startLine];
			const max = state.eMarks[startLine];
			const src = state.src;

			// Check for \[ at start of line
			if (start + 2 > max) return false;
			if (src.charCodeAt(start) !== 0x5c || src.charCodeAt(start + 1) !== 0x5b)
				return false;

			// Find closing \]
			let found = false;
			let endPos = start;
			for (let line = startLine; line < endLine; line++) {
				const lineStart = state.bMarks[line] + state.tShift[line];
				const lineEnd = state.eMarks[line];
				const lineContent = src.slice(lineStart, lineEnd);
				const bracketIndex = lineContent.indexOf('\\]');
				if (bracketIndex !== -1) {
					found = true;
					endPos = lineStart + bracketIndex;
					break;
				}
			}

			if (!found) return false;

			if (silent) return true;

			const content = src.slice(start + 2, endPos);
			const token = state.push('math_block', 'math', 0);
			token.block = true;
			token.content = content;
			token.map = [startLine, state.line];
			token.markup = '$$';

			state.line = startLine + 1;
			return true;
		}

		// Register the rules before escape to avoid backslash escaping
		md.inline.ruler.before('escape', 'math_inline_parens', mathInlineParens);
		md.block.ruler.before(
			'blockquote',
			'math_block_bracket',
			mathBlockBracket,
			{
				alt: ['paragraph', 'reference', 'blockquote', 'list'],
			},
		);
	}
}

export default MarkdownParser;
