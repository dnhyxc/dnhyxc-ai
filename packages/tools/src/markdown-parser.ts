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

/** 梯形等节点：[/.../]，勿对其中的 / 做自动加引号 */
function mermaidBracketLabelLooksTrapezoid(label: string): boolean {
	const t = label.trim();
	return t.length >= 3 && t.startsWith('/') && t.endsWith('/');
}

const MERMAID_FLOWCHART_ID_SKIP = new Set([
	'subgraph',
	'end',
	'flowchart',
	'graph',
	'direction',
	'classDef',
	'class',
	'linkStyle',
	'click',
	'style',
	'break',
	'continue',
]);

function escapeMermaidDoubleQuotedLabelInner(raw: string): string {
	return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 为未加引号且含 / 或 + 的方括号文案补双引号，减轻 Mermaid 解析失败（预览区只剩 DSL 文本）。
 * 不改变已带引号的片段；跳过梯形 [/.../]。
 */
function relaxMermaidBracketLabels(body: string): string {
	let text = body;
	text = text.replace(
		/(^|\n)([\t ]*subgraph\s+\S+\s+)\[([^\]\r\n]+)\]/g,
		(full, lead, pre, title) => {
			const raw = title as string;
			const t = raw.trim();
			if (t.startsWith('"') || mermaidBracketLabelLooksTrapezoid(raw)) {
				return full;
			}
			if (t.includes('/') || t.includes('+')) {
				return `${lead}${pre}["${escapeMermaidDoubleQuotedLabelInner(raw)}"]`;
			}
			return full;
		},
	);
	text = text.replace(
		/\b([A-Za-z_][\w]*)\[([^\]\r\n]*)\]/g,
		(full, id, label) => {
			if (MERMAID_FLOWCHART_ID_SKIP.has(id)) return full;
			const raw = label as string;
			const t = raw.trim();
			if (t.startsWith('"') || mermaidBracketLabelLooksTrapezoid(raw)) {
				return full;
			}
			if (t.includes('/') || t.includes('+')) {
				return `${id}["${escapeMermaidDoubleQuotedLabelInner(raw)}"]`;
			}
			return full;
		},
	);
	return text;
}

/**
 * Mermaid 围栏源码预处理：统一换行，并对含 /、+ 的未加引号方括号文案补引号。
 * 供 MarkdownParser 与流式 Mermaid 岛等共用。
 */
export function normalizeMermaidFenceBody(body: string): string {
	const eol = body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	return relaxMermaidBracketLabels(eol);
}

// 正文/公式样式仍建议 import '@dnhyxc-ai/tools/styles.css' 或 markdown-base.css。
// 代码块主题可通过构造参数 highlightTheme（CDN）或 highlightThemeCss（内联）注入，亦可继续用手动 import。

/** 流式 / 预览：Markdown 段与 Mermaid 岛交替（与 `splitForMermaidIslands` 返回一致） */
export type MarkdownMermaidSplitPart =
	| { type: 'markdown'; text: string }
	| { type: 'mermaid'; text: string; complete: boolean };

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
	/**
	 * 是否将 ```mermaid 围栏解析为 Mermaid 占位 DOM。
	 * 为 false 时按普通代码块展示；实例字段 `enableMermaid` 与之一致，配合 `@dnhyxc-ai/tools/react` 的 `useMermaidInMarkdownRoot`。
	 * @default true
	 */
	enableMermaid?: boolean;
}

class MarkdownParser {
	/** 与构造参数 `enableMermaid` 一致（默认 true） */
	readonly enableMermaid: boolean;
	private md;
	private containerClass: string;
	private onError?: (error: unknown) => void;

	constructor(options: MarkdownParserOptions = {}) {
		this.enableMermaid = options.enableMermaid !== false;
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

		if (this.enableMermaid) {
			this.patchMermaidFence();
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
	 * 包裹 fence：语言为 mermaid 时输出占位结构，插入 DOM 后由 `@dnhyxc-ai/tools/react` 的 `useMermaidInMarkdownRoot` 渲染。
	 */
	private patchMermaidFence(): void {
		const md = this.md;
		const prev = md.renderer.rules.fence;
		if (!prev) return;
		md.renderer.rules.fence = (tokens, idx, options, env, self) => {
			const token = tokens[idx];
			const info = token.info
				? md.utils.unescapeAll(String(token.info)).trim()
				: '';
			const langName = info.split(/\s+/g)[0] || '';
			if (langName.toLowerCase() === 'mermaid') {
				const body = md.utils.escapeHtml(
					normalizeMermaidFenceBody(token.content),
				);
				return (
					'<div class="markdown-mermaid-wrap" data-mermaid="1">' +
					'<div class="mermaid">' +
					body +
					'</div></div>\n'
				);
			}
			return prev(tokens, idx, options, env, self);
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

	private static coalesceMarkdownMermaidParts(
		parts: MarkdownMermaidSplitPart[],
	): MarkdownMermaidSplitPart[] {
		const out: MarkdownMermaidSplitPart[] = [];
		for (const p of parts) {
			if (p.type === 'markdown' && p.text === '') continue;
			const last = out[out.length - 1];
			if (p.type === 'markdown' && last?.type === 'markdown') {
				last.text += p.text;
			} else {
				out.push(p.type === 'markdown' ? { ...p } : { ...p });
			}
		}
		return out;
	}

	/**
	 * 用与 `render` 相同的 markdown-it 语法树切分：仅把 ```mermaid 段拆成独立岛，其余保持 Markdown 源码再 render。
	 * 替代手写按行扫 ``` 的方式，使列表内代码块、与开头缩进不一致的闭合行等与渲染器一致，避免拆块错位。
	 *
	 * **与 `enableMermaid` 解耦**：`md.parse` 识别围栏不依赖渲染期 Mermaid 补丁；即使实例为
	 * `enableMermaid: false`（聊天里用其 `render` 普通代码块），仍可按令牌拆出 mermaid 段交给独立岛。
	 */
	public splitForMermaidIslands(source: string): MarkdownMermaidSplitPart[] {
		const normalized = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
		const lines = normalized.split('\n');
		const lineCount = lines.length;
		/**
		 * 按行号截取原文行块。若后面还有行（b < lineCount），在段末补一个 `\n`：
		 * `lines.slice(a,b).join('\n')` 只有「行与行之间」的换行，缺少「最后一段行末」与「下一段首行」之间的换行，
		 * 与下一段拼接会变成 `### 标题` + `` ```ts ``，围栏无法识别（Mermaid 段用 token.content 不受影响）。
		 */
		const sliceLines = (a: number, b: number) => {
			const lo = Math.max(0, a);
			const hi = Math.min(b, lineCount);
			if (lo >= hi) return '';
			const body = lines.slice(lo, hi).join('\n');
			return hi < lineCount ? `${body}\n` : body;
		};

		const tokens = this.md.parse(normalized, {});
		const raw: MarkdownMermaidSplitPart[] = [];
		let lastLine = 0;

		for (const t of tokens) {
			if (t.type !== 'fence' || t.map == null) continue;
			const [start, end] = t.map;
			if (start < lastLine) continue;
			if (start > lastLine) {
				const prose = sliceLines(lastLine, start);
				if (prose !== '') raw.push({ type: 'markdown', text: prose });
			}

			const rawFence = sliceLines(start, end);
			const info = t.info ? (String(t.info).trim().split(/\s+/)[0] ?? '') : '';
			const lang = info.toLowerCase();
			const body = t.content ?? '';

			// 列表内顶格闭合时 markdown-it 可能多出一个无 info、无正文的 fence 令牌（空 <pre>）；跳过且不丢行号
			const fenceOnly = rawFence.replace(/\n+$/u, '').trim();
			const orphanCloser =
				!lang &&
				!body.trim() &&
				/^`{3,}\s*$/u.test(fenceOnly.replace(/^[ \t]*/u, ''));

			if (orphanCloser) {
				lastLine = end;
				continue;
			}

			if (lang === 'mermaid') {
				raw.push({ type: 'mermaid', text: body, complete: true });
			} else if (rawFence !== '') {
				raw.push({ type: 'markdown', text: rawFence });
			}
			lastLine = end;
		}

		if (lastLine < lineCount) {
			const tail = sliceLines(lastLine, lineCount);
			if (tail !== '') raw.push({ type: 'markdown', text: tail });
		}

		const merged = MarkdownParser.coalesceMarkdownMermaidParts(raw);
		if (merged.length === 0 && normalized) {
			return [{ type: 'markdown', text: normalized }];
		}
		return merged;
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
