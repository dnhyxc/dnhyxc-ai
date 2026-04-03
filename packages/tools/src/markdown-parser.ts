// MarkdownParser.ts
import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import type Token from 'markdown-it/lib/token.mjs';
import markdownItKatex from 'markdown-it-katex';
// CJS 包，无官方类型
import markdownItTaskLists from 'markdown-it-task-lists';
import type { HighlightJsThemeId } from './generated/highlight-js-theme-ids.js';
import { applyHighlightJsTheme } from './inject-highlight-theme.js';

function taskListAttrSet(token: Token, name: string, value: string): void {
	const index = token.attrIndex(name);
	const attr: [string, string] = [name, value];
	if (index < 0) {
		token.attrPush(attr);
	} else {
		token.attrs![index] = attr;
	}
}

function taskListParentTokenIndex(tokens: Token[], index: number): number {
	const targetLevel = tokens[index].level - 1;
	for (let i = index - 1; i >= 0; i--) {
		if (tokens[i].level === targetLevel) {
			return i;
		}
	}
	return -1;
}

/** markdown-it render(env) 上挂标题 slug 计数，供锚点 id 去重 */
export type MarkdownRenderEnv = {
	headingSlugCounts?: Record<string, number>;
};

/** 从 heading 后的 inline token 抽纯文本，用于生成与目录链接一致的 slug */
function headingPlainTextFromInline(inlineToken: Token | undefined): string {
	if (!inlineToken || inlineToken.type !== 'inline' || !inlineToken.content) {
		return '';
	}
	let s = inlineToken.content;
	s = s
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
	s = s.replace(/`+([^`]+)`+/g, '$1');
	s = s.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1');
	s = s.replace(/__([^_]+)__/g, '$1').replace(/_([^_]+)_/g, '$1');
	s = s.replace(/~~([^~]+)~~/g, '$1');
	return s.trim();
}

/** 生成 HTML id（与常见 GFM 目录链接风格接近）；空标题用行号兜底 */
function slugifyHeadingText(text: string, line1Based: number): string {
	let base = text
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s\-_]/gu, '')
		.trim()
		.replace(/\s+/g, '-');
	base = base.replace(/^-+/, '');
	if (!base) {
		base = `heading-${line1Based}`;
	}
	return base;
}

function nextHeadingAnchorId(base: string, env: MarkdownRenderEnv): string {
	if (!env.headingSlugCounts) {
		env.headingSlugCounts = {};
	}
	const counts = env.headingSlugCounts;
	counts[base] = (counts[base] ?? 0) + 1;
	const n = counts[base];
	return n === 1 ? base : `${base}-${n - 1}`;
}

// 正文/公式样式仍建议 import '@dnhyxc-ai/tools/styles.css' 或 markdown-base.css。
// 代码块主题可通过构造参数 highlightTheme（CDN）或 highlightThemeCss（内联）注入，亦可继续用手动 import。

export interface MarkdownParserOptions {
	html?: boolean;
	linkify?: boolean;
	typographer?: boolean;
	breaks?: boolean;
	// 允许自定义包裹的容器类名，默认为 markdown-body
	containerClass?: string;
	// 可选：自定义错误处理函数
	onError?: (error: unknown) => void;
	/**
	 * 为围栏代码块输出带工具栏的 DOM（语言 / 复制 / 下载），供聊天等场景配合滚动同步贴顶。
	 * 默认 false，避免会话列表、编辑器等处的代码块出现多余按钮。
	 */
	enableChatCodeFenceToolbar?: boolean;
	/**
	 * highlight.js 主题 id（与 highlightJsThemes / highlightJsThemeIds 一致，如 `github-dark`、`atom-one-dark`、`base16/dracula`）。
	 * 设置后在浏览器内向 document.head 注入一条 `<link rel="stylesheet">`（jsDelivr CDN，需联网）。
	 * 若同时设置 highlightThemeCss（非空字符串），则仅用内联样式，不请求 CDN。
	 */
	highlightTheme?: HighlightJsThemeId;
	/**
	 * 主题 CSS 全文；适合离线、Tauri 或与打包器 `?raw` 结合。非空时优先于 highlightTheme 的 CDN。
	 * 传空字符串 `''` 表示仅移除本包已注入的主题节点，不再挂载新样式。
	 */
	highlightThemeCss?: string;
	/**
	 * 为 false 时不执行主题注入（即使传了 highlightTheme / highlightThemeCss），便于完全由外部 import 控制样式。
	 * @default true
	 */
	injectHighlightTheme?: boolean;
	/**
	 * 为标题标签写入 `data-md-heading-line`（1-based 源码行号，与 Monaco 一致），供分屏预览按标题对齐滚动。
	 * @default false
	 */
	enableHeadingSourceLineAttr?: boolean;
	/**
	 * 为标题写入 `id`（由标题纯文本 slug 化 + 重复时 `-1`、`-2`），供 `[目录](#xxx)` 页内跳转。
	 * 需与 `render` 传入的 **env** 配合（本类 `render()` 已内置）；默认 false。
	 */
	enableHeadingAnchorIds?: boolean;
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

		this.md.use(markdownItKatex, {
			// 关闭 KaTeX 报错，防止公式解析失败时中断渲染
			throwOnError: false,
			// 禁用 displayMode，让公式按行内模式处理
			displayMode: false,
			// 信任输入，允许渲染任意 LaTeX
			// trust: true,
			// 忽略严格模式，避免格式警告
			strict: 'ignore',
			// 将错误颜色设为透明，用户看不到渲染异常
			errorColor: 'transparent',
		});

		// GFM 待办列表（有序 / 无序均可），与 github-markdown-css 的 .task-list-item 等配套
		this.md.use(markdownItTaskLists, {
			// 静态 HTML 与 GitHub 展示一致，禁用交互避免 XSS 面
			enabled: false,
		});

		this.patchGfmTaskListBareMarkers();

		// Add support for \(...\) and \[...\] delimiters
		this.addLatexDelimiters();

		if (options.enableChatCodeFenceToolbar) {
			this.patchChatCodeFenceRenderer();
		}

		if (options.enableHeadingSourceLineAttr || options.enableHeadingAnchorIds) {
			this.patchHeadingPreviewAttrs(options);
		}

		const shouldInject = options.injectHighlightTheme !== false;
		if (shouldInject) {
			applyHighlightJsTheme({
				themeId: options.highlightTheme,
				themeCss: options.highlightThemeCss,
				onError: options.onError,
			});
		}
	}

	/**
	 * markdown-it-task-lists 依赖 `[ ] ` / `[x] ` 等「标记后带空格」；解析后纯 `[x]`、`[ ]` 常见于行尾无正文，
	 * 且补空格也会被 markdown-it 吃掉。对这类列表项在 core 阶段补渲染勾选框。
	 */
	private patchGfmTaskListBareMarkers(): void {
		const md = this.md;
		md.core.ruler.after(
			'github-task-lists',
			'gfm-task-list-bare',
			(state: StateCore) => {
				const tokens = state.tokens;
				const TokenCtor = state.Token;
				for (let i = 2; i < tokens.length; i++) {
					const inline = tokens[i];
					if (inline.type !== 'inline') continue;
					if (tokens[i - 1].type !== 'paragraph_open') continue;
					if (tokens[i - 2].type !== 'list_item_open') continue;

					const c = inline.content;
					if (c !== '[x]' && c !== '[X]' && c !== '[ ]') continue;

					const checked = c !== '[ ]';
					const checkbox = new TokenCtor('html_inline', '', 0);
					checkbox.content = `<input class="task-list-item-checkbox"${checked ? ' checked=""' : ''} disabled="" type="checkbox">`;

					const children = inline.children;
					if (!children?.length || children[0].type !== 'text') continue;

					children.unshift(checkbox);
					children[1].content = '';
					inline.content = '';

					taskListAttrSet(tokens[i - 2], 'class', 'task-list-item');
					const listIdx = taskListParentTokenIndex(tokens, i - 2);
					if (listIdx >= 0) {
						taskListAttrSet(tokens[listIdx], 'class', 'contains-task-list');
					}
				}
			},
		);
	}

	/**
	 * 覆盖 fence 渲染：外层 chat-md-code-block + 工具栏 + pre/code，高亮逻辑与默认 highlight 一致。
	 */
	private patchChatCodeFenceRenderer(): void {
		const md = this.md;
		md.renderer.rules.fence = (tokens, idx, options, _env, _slf) => {
			const token = tokens[idx];
			const info = token.info
				? md.utils.unescapeAll(String(token.info)).trim()
				: '';
			const langName = info.split(/\s+/g)[0] || '';
			let highlighted = '';
			if (options.highlight) {
				highlighted = options.highlight(token.content, langName, '') || '';
			}
			if (!highlighted) {
				highlighted = md.utils.escapeHtml(token.content);
			}
			const escapedLangLabel = md.utils.escapeHtml(langName || 'text');
			const codeClass = langName
				? `language-${md.utils.escapeHtml(langName)} hljs`
				: 'hljs';
			return (
				'<div class="chat-md-code-block" data-chat-code-block>' +
				'<div class="chat-md-code-toolbar-slot">' +
				'<div class="chat-md-code-toolbar">' +
				'<span class="chat-md-code-lang">' +
				escapedLangLabel +
				'</span>' +
				'<div class="chat-md-code-actions">' +
				'<button type="button" class="chat-md-code-btn" data-chat-code-action="copy">复制</button>' +
				'<button type="button" class="chat-md-code-btn" data-chat-code-action="download" data-chat-code-lang="' +
				escapedLangLabel +
				'">下载</button>' +
				'</div></div></div>' +
				'<pre><code class="' +
				codeClass +
				'">' +
				highlighted +
				'</code></pre></div>\n'
			);
		};
	}

	/**
	 * 为 heading_open 注入 `data-md-heading-line`、可选 `id`（目录锚点），与 markdown-it 的 token.map 一致。
	 */
	private patchHeadingPreviewAttrs(options: MarkdownParserOptions): void {
		const wantLine = !!options.enableHeadingSourceLineAttr;
		const wantId = !!options.enableHeadingAnchorIds;
		const md = this.md;
		const prev = md.renderer.rules.heading_open;
		md.renderer.rules.heading_open = (tokens, idx, opt, env, self) => {
			const token = tokens[idx];
			const map = token.map;
			const line1 = map ? map[0] + 1 : 1;
			if (map && wantLine) {
				taskListAttrSet(token, 'data-md-heading-line', String(line1));
			}
			if (map && wantId) {
				const inline = tokens[idx + 1];
				const plain = headingPlainTextFromInline(inline);
				const base = slugifyHeadingText(plain, line1);
				const renderEnv = env as MarkdownRenderEnv;
				const id = nextHeadingAnchorId(base, renderEnv);
				taskListAttrSet(token, 'id', id);
			}
			if (prev) {
				return prev(tokens, idx, opt, env, self);
			}
			return self.renderToken(tokens, idx, opt);
		};
	}

	/**
	 * 解析 Markdown 并自动包裹样式容器
	 * @param text Markdown 文本
	 * @returns 带有样式容器的 HTML 字符串
	 */
	public render(text: string): string {
		if (!text) return '';

		// Replace \text{○} with \circ to avoid KaTeX missing character metrics
		// The ○ character (U+25CB) causes warnings that break markdown-it-katex rendering
		// Using \circ (circle operator) is a valid LaTeX alternative
		const processedText = text.replace(/\\text{○}/g, '\\circ');

		try {
			const env: MarkdownRenderEnv = {};
			const rawHtml = this.md.render(processedText, env);
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
			_state: any,
			_pos: number,
		): { can_open: boolean; can_close: boolean } {
			// Always allow delimiters to open and close
			// This simplifies the logic and ensures \(...\) always works
			return { can_open: true, can_close: true };
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
