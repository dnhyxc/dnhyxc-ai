# `@dnhyxc-ai/tools`

Monorepo 内的 Markdown 工具包，**功能一览**：

| 能力 | 使用方式 |
| ---- | -------- |
| Markdown → HTML（GFM 风格正文、链接、换行等） | `new MarkdownParser()` + `render()`；选项见 §1。 |
| 数学公式（KaTeX） | 默认开启；需引入 **katex** 相关 CSS（如 `styles.css` / `markdown-base.css`）。 |
| 代码高亮（highlight.js） | 围栏语言名 + **`highlightTheme` / `highlightThemeCss`** 或手动 import hljs CSS。 |
| GFM 待办列表 | 内置，无需开关；样式依赖 **github-markdown-css**。 |
| 聊天围栏工具栏 | `enableChatCodeFenceToolbar: true`，宿主处理按钮事件。 |
| Mermaid 占位 + 浏览器渲染 | `enableMermaid`（默认开）+ **`@dnhyxc-ai/tools/react`**；流式聊天拆块示例见 **README §4.6**，架构说明见 **`docs/tools.md` §11.9**。 |
| 标题行号 / 锚点 id | `enableHeadingSourceLineAttr` / `enableHeadingAnchorIds`。 |
| 主题 CDN / 内联 / 清除 | `applyHighlightJsTheme`、`clearAppliedHighlightJsTheme`、`resolveHighlightJsThemeSpecifier`。 |
| 样式一键引入 / 按文件引入 | `styles.css`、`markdown-base.css`、`styles/hljs/*.min.css`。 |

**更完整的架构说明、边界行为、流式聊天 Mermaid 与故障排查见 [`docs/tools.md`](../../docs/tools.md)。** 与本仓库 **`apps/frontend/src`** 一致的调用方式见 **§4**。

---

## 安装与构建

在应用 **`package.json`** 中声明：

```json
"@dnhyxc-ai/tools": "workspace:*"
```

然后在 monorepo 根目录执行 **`pnpm install`**。发包或改包内源码后需生成 **`dist`**：

```bash
pnpm --filter @dnhyxc-ai/tools run build
```

---

## 条件导出（`package.json` → `exports`）

| 子路径 | 用途 |
| ------ | ---- |
| `@dnhyxc-ai/tools` | 主入口：`MarkdownParser`、主题 API、样式元数据等。 |
| `@dnhyxc-ai/tools/styles` | `highlightJsThemes` / `highlightJsThemeIds` 等运行时元数据 + 类型。 |
| `@dnhyxc-ai/tools/styles.css` / `markdown-styles.css` | 合并默认样式（含 github-markdown + katex + 默认 hljs 等）。 |
| `@dnhyxc-ai/tools/markdown-base.css` | 正文 + KaTeX，**不含**完整 hljs（可再自选主题 CSS）。 |
| `@dnhyxc-ai/tools/styles/hljs/<主题>.min.css` | 单个 highlight.js 主题文件。 |
| `@dnhyxc-ai/tools/react` | `useMermaidInMarkdownRoot`、`runMermaidInMarkdownRoot` 及类型（peer：`react`）。 |

`sideEffects: true`：存在 CSS 副作用；勿在未引样式时期望仅靠 tree-shaking 得到完整排版。

---

## 1. `MarkdownParser` 基础用法

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/styles.css';

const parser = new MarkdownParser({
	injectHighlightTheme: false, // 已手动 import styles.css 时建议关闭，避免重复 hljs
});

document.getElementById('preview')!.innerHTML = parser.render('# 标题\n\n正文');
```

- **`render(text)`**：返回包裹 **`containerClass`**（默认 `markdown-body`）的 HTML 字符串；失败时调用可选 **`onError`**，并回退为带容器的原文。
- **内置能力**：`html` / `linkify` / `typographer` / `breaks`（均可通过构造选项关闭或调整；其中 `html` **默认关闭**，避免 raw HTML 带来 XSS 风险）、**KaTeX**（`$...$` 等 + `\(...\)` / `\[...\]`）、**highlight.js** 围栏高亮、**GFM 待办列表**（`markdown-it-task-lists` + 裸 `[x]`/`[ ]` 补丁）。

### 1.0 安全提示：raw HTML 与 XSS

`MarkdownParser` 的渲染结果通常会被宿主通过 `innerHTML` 或 `dangerouslySetInnerHTML` 挂载到页面。若允许 raw HTML（`html: true`），输入如下内容时：

```html
<script>alert("XSS Attack! Your cookie is: " + document.cookie)</script>
```

将可能触发 **XSS（跨站脚本攻击）**。因此本工具包默认 **`html: false`**（raw HTML 作为文本转义输出）。

如确需支持少量 HTML：

- 请显式设置 `new MarkdownParser({ html: true })`
- 并在宿主侧对最终 HTML 做 **sanitize（清洗）**：建议白名单方式，仅放行必要标签/属性

### 1.1 常用构造选项（摘录）

| 选项 | 说明 |
| ---- | ---- |
| `containerClass` | 外层包裹类名，默认 `markdown-body`。 |
| `onError` | 解析异常回调。 |
| `enableChatCodeFenceToolbar` | `true` 时围栏输出聊天用工具栏 DOM（复制/下载）；**样式与点击由宿主实现**。 |
| `highlightTheme` | **HighlightJsThemeId**，经 CDN 向 `document.head` 注入 hljs 主题（需联网）。 |
| `highlightThemeCss` | 主题 CSS 全文（离线/`?raw`）；非空优先于 `highlightTheme`。传 `''` 可仅移除本包注入节点。 |
| `injectHighlightTheme` | 默认 `true`；`false` 则完全不注入，改用手动 `import '*.css'`。 |
| `enableHeadingSourceLineAttr` | 为标题写 `data-md-heading-line`（Monaco 对齐等，默认关）。 |
| `enableHeadingAnchorIds` | 为标题写 `id`（目录锚点跳转，默认开）。 |
| `enableMermaid` | 默认 `true`：` ```mermaid ` 输出占位 DOM；`false` 则按普通代码块。与 **`@dnhyxc-ai/tools/react`** 配合渲染 SVG。 |

完整列表与默认值以 **`MarkdownParserOptions`** 类型及源码为准。

**标题预览增强**（Monaco 分屏、目录跳转）：

```ts
const parser = new MarkdownParser({
	enableHeadingSourceLineAttr: true,
});
// render() 内部已传入 env，锚点 id 在重复标题时会自动加 -1、-2…
```

### 1.2 仅 CDN 注入 hljs、不引合并 CSS

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/markdown-base.css';

const parser = new MarkdownParser({
	highlightTheme: 'github-dark',
});
```

### 1.3 离线 / `?raw` 注入 hljs

```tsx
import css from '@dnhyxc-ai/tools/styles/hljs/night-owl.min.css?raw';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/markdown-base.css';

const parser = new MarkdownParser({ highlightThemeCss: css });
```

---

## 2. 样式与主题元数据

### 2.1 手动 import 主题路径（类型安全）

```ts
import type { HighlightJsThemeId } from '@dnhyxc-ai/tools';
import { resolveHighlightJsThemeSpecifier } from '@dnhyxc-ai/tools';

const id: HighlightJsThemeId = 'atom-one-dark';
// 得到如 @dnhyxc-ai/tools/styles/hljs/atom-one-dark.min.css
const spec = resolveHighlightJsThemeSpecifier(id);
```

### 2.2 运行时注入 / 清除（全局单例节点）

```ts
import {
	applyHighlightJsTheme,
	clearAppliedHighlightJsTheme,
} from '@dnhyxc-ai/tools';

applyHighlightJsTheme({ themeId: 'github-dark' });
// applyHighlightJsTheme({ themeCss: cssString });
// clearAppliedHighlightJsTheme();
```

### 2.3 `styles` 子路径导出

从 **`import { highlightJsThemes, highlightJsThemeIds, defaultHighlightJsThemeId, styles, styleUrls, styleContents } from '@dnhyxc-ai/tools'`** 或 **`@dnhyxc-ai/tools/styles`** 读取主题 id 列表、相对路径映射及少量内联 CSS 字符串（**不含**全部主题内联）。

---

## 3. `@dnhyxc-ai/tools/react`（Mermaid）

适用于：**单次或低频**更新整块 `dangerouslySetInnerHTML` 的预览区（如 Monaco、文档页）。在 **`enableMermaid: true`** 的 `MarkdownParser` 渲染结果挂载到 DOM 后调用。

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { useMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import { useMemo, useRef } from 'react';

export function Preview({ md, preferDark }: { md: string; preferDark: boolean }) {
	const rootRef = useRef<HTMLDivElement>(null);
	const parser = useMemo(
		() => new MarkdownParser({ injectHighlightTheme: false }),
		[],
	);

	useMermaidInMarkdownRoot({
		rootRef,
		preferDark,
		trigger: md,
		parser,
		// 可选：trigger 极高频时节流（详见 docs/tools.md §11）
		// throttleMs: 280,
	});

	return (
		<div
			ref={rootRef}
			dangerouslySetInnerHTML={{ __html: parser.render(md) }}
		/>
	);
}
```

- **`runMermaidInMarkdownRoot(root, { preferDark?, suppressErrors? })`**：非 React 环境可自行调度调用（从同一子路径导出）。
- **流式聊天**若对**整段正文**高频 `dangerouslySetInnerHTML`，会反复冲掉 Mermaid 的 SVG；本仓库助手消息采用 **围栏拆分 + 独立岛**（实现示例见 **README §4.6**，原理见 **`docs/tools.md` §11.9**），**不是**单靠本 hook 能根治的场景。

依赖：**`mermaid`** 已由本包 **`dependencies`** 声明；打包器需能解析 `import 'mermaid'`（Vite 可将 `@dnhyxc-ai/tools/react` 与 `mermaid` 列入 `optimizeDeps.include`）。

---

## 4. 与 `apps/frontend/src` 用法对照（示例代码）

以下片段与本仓库前端实际用法一致，可直接对照 [`apps/frontend`](../../apps/frontend/src) 源码；其中 **`getChatMarkdownHighlightTheme`** 等为应用侧封装，示例内用占位说明。

### 4.1 主题 id：`HighlightJsThemeId` 与亮色/暗色映射

[`apps/frontend/src/constant/index.ts`](../../apps/frontend/src/constant/index.ts)：

```ts
import type { HighlightJsThemeId } from '@dnhyxc-ai/tools';

/** Chat / 文档等 MarkdownParser 的 highlight.js 主题：暗色 UI 用暗色高亮，否则亮色高亮。 */
export function getChatMarkdownHighlightTheme(themeName: 'black' | 'light'): HighlightJsThemeId {
	return themeName === 'black' ? 'atom-one-dark' : 'atom-one-light';
}
```

### 4.2 用户消息：整段 `render` + `dangerouslySetInnerHTML`

[`apps/frontend/src/components/design/ChatUserMessage/index.tsx`](../../apps/frontend/src/components/design/ChatUserMessage/index.tsx)（节选）：

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { useMemo } from 'react';

function ChatUserMessage({ message, appTheme }: { message: { content: string }; appTheme: 'black' | 'light' }) {
	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme],
	);

	return (
		<div
			className="max-w-none text-left [&_.markdown-body]:text-textcolor/90!"
			dangerouslySetInnerHTML={{ __html: parser.render(message.content) }}
		/>
	);
}
```

### 4.3 历史会话列表：父级共享一个 `MarkdownParser` 下发子项

[`apps/frontend/src/views/chat/session-list/index.tsx`](../../apps/frontend/src/views/chat/session-list/index.tsx)（节选）：

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { memo, useMemo } from 'react';

const SessionItem = memo(function SessionItem({
	item,
	parser,
}: {
	item: { title?: string; messages?: { content: string }[] };
	parser: MarkdownParser;
}) {
	return (
		<div
			className="line-clamp-1 text-sm [&_.markdown-body]:text-textcolor!"
			dangerouslySetInnerHTML={{
				__html: parser.render(item?.title || item.messages?.[0]?.content || '新对话'),
			}}
		/>
	);
});

function SessionList({ appTheme }: { appTheme: 'black' | 'light' }) {
	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme],
	);

	return (
		<>
			{/* 列表项传入同一 parser，避免每条新建解析器 */}
			<SessionItem item={/* ... */} parser={parser} />
		</>
	);
}
```

### 4.4 文档处理页：合并样式 + `useMermaidInMarkdownRoot` + `trigger` 驱动重绘

[`apps/frontend/src/views/document/index.tsx`](../../apps/frontend/src/views/document/index.tsx)（节选）：

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { useMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import '@dnhyxc-ai/tools/styles.css';
import { useMemo, useRef } from 'react';

function DocumentAnalysisPreview({ content, appTheme }: { content: string; appTheme: 'black' | 'light' }) {
	const analysisMarkdownRef = useRef<HTMLDivElement>(null);

	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme],
	);

	useMermaidInMarkdownRoot({
		rootRef: analysisMarkdownRef,
		preferDark: appTheme === 'black',
		trigger: content,
		parser,
	});

	return (
		<div
			ref={analysisMarkdownRef}
			dangerouslySetInnerHTML={{ __html: parser.render(content) }}
		/>
	);
}
```

### 4.5 Monaco Markdown 预览：`useMemo(html)` + 与 `innerHTML` 同层的 ref + 可关 Mermaid

[`apps/frontend/src/components/design/Monaco/index.tsx`](../../apps/frontend/src/components/design/Monaco/index.tsx) 中 `ParserMarkdownPreviewPane`（节选）：预览根节点与 `dangerouslySetInnerHTML` **同层**，`trigger` 用预计算的 **`html`**，避免 Mermaid 扫描早于 DOM 写入。

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { useMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import { useMemo, useRef } from 'react';

function ParserMarkdownPreviewPane({
	markdown,
	appTheme,
	enableMermaid = true,
}: {
	markdown: string;
	appTheme: 'black' | 'light';
	enableMermaid?: boolean;
}) {
	const previewHtmlRootRef = useRef<HTMLDivElement>(null);

	const parser = useMemo(
		() =>
			new MarkdownParser({
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
				enableChatCodeFenceToolbar: true,
				enableHeadingSourceLineAttr: true,
				enableMermaid,
			}),
		[appTheme, enableMermaid],
	);

	const html = useMemo(() => parser.render(markdown), [parser, markdown]);

	useMermaidInMarkdownRoot({
		rootRef: previewHtmlRootRef,
		preferDark: appTheme === 'black',
		trigger: html,
		parser,
	});

	return (
		<div className="markdown-preview-shell">
			<div ref={previewHtmlRootRef} dangerouslySetInnerHTML={{ __html: html }} />
		</div>
	);
}
```

### 4.6 助手消息流式：`enableMermaid: false` + 围栏拆块 + `runMermaidInMarkdownRoot`

[`apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`](../../apps/frontend/src/components/design/ChatAssistantMessage/index.tsx) 使用 **`enableMermaid: false`** 的解析器，避免与 Mermaid 岛重复；正文由 [`StreamingMarkdownBody`](../../apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx) 按围栏切分，岛内调用 **`runMermaidInMarkdownRoot`**。仓库内实现文件为 [`splitMarkdownFences.ts`](../../apps/frontend/src/utils/splitMarkdownFences.ts)；**下方贴出与该文件一致的完整源码**（前端可用路径别名 `@/utils/splitMarkdownFences` 引用同内容）。

**`splitMarkdownFences` 完整实现：**

```ts
/**
 * 按顶格代码围栏拆分 Markdown，将 mermaid 与其它内容分离。
 * 用于聊天流式：Mermaid 单独 React 岛渲染，避免整段 dangerouslySetInnerHTML 冲掉已生成的 SVG。
 */

export type MarkdownFencePart =
	| { type: 'markdown'; text: string }
	| { type: 'mermaid'; text: string; complete: boolean };

function coalesceMarkdownParts(
	parts: MarkdownFencePart[],
): MarkdownFencePart[] {
	const out: MarkdownFencePart[] = [];
	for (const p of parts) {
		if (p.type === 'markdown' && p.text === '') continue;
		const last = out[out.length - 1];
		if (p.type === 'markdown' && last?.type === 'markdown') {
			last.text += p.text;
		} else {
			out.push(
				p.type === 'markdown' ? { type: 'markdown', text: p.text } : { ...p },
			);
		}
	}
	return out;
}

/**
 * 扫描 ```lang 围栏；mermaid 且未闭合时 `complete: false`（流式尾部）。
 */
export function splitMarkdownByCodeFences(source: string): MarkdownFencePart[] {
	const out: MarkdownFencePart[] = [];
	let i = 0;
	const n = source.length;

	while (i < n) {
		const fenceStart = source.indexOf('```', i);
		if (fenceStart === -1) {
			const tail = source.slice(i);
			if (tail) out.push({ type: 'markdown', text: tail });
			break;
		}
		if (fenceStart > i) {
			out.push({ type: 'markdown', text: source.slice(i, fenceStart) });
		}
		const langEnd = source.indexOf('\n', fenceStart + 3);
		if (langEnd === -1) {
			out.push({ type: 'markdown', text: source.slice(fenceStart) });
			break;
		}
		const lang = source
			.slice(fenceStart + 3, langEnd)
			.trim()
			.toLowerCase();
		const bodyStart = langEnd + 1;
		const closeIdx = source.indexOf('```', bodyStart);
		if (closeIdx === -1) {
			if (lang === 'mermaid') {
				out.push({
					type: 'mermaid',
					text: source.slice(bodyStart),
					complete: false,
				});
			} else {
				out.push({ type: 'markdown', text: source.slice(fenceStart) });
			}
			break;
		}
		const body = source.slice(bodyStart, closeIdx);
		if (lang === 'mermaid') {
			out.push({ type: 'mermaid', text: body, complete: true });
		} else {
			out.push({
				type: 'markdown',
				text: source.slice(fenceStart, closeIdx + 3),
			});
		}
		i = closeIdx + 3;
	}

	if (out.length === 0 && source) {
		out.push({ type: 'markdown', text: source });
	}
	return coalesceMarkdownParts(out);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** 未闭合 mermaid 围栏：纯代码预览（不跑 Mermaid，避免语法不完整报错与整页重绘） */
export function mermaidStreamingFallbackHtml(code: string): string {
	const esc = escapeHtml(code);
	return `<div class="markdown-body"><pre class="chat-md-mermaid-streaming"><code class="language-mermaid">${esc}</code></pre></div>`;
}
```

**解析器 + 宿主点击工具栏（节选）：**

```tsx
import { MarkdownParser } from '@dnhyxc-ai/tools';
import { useEffect, useMemo, useRef } from 'react';

function AssistantMessageShell({ appTheme }: { appTheme: 'black' | 'light' }) {
	const shellRef = useRef<HTMLDivElement>(null);

	const chatMdParser = useMemo(
		() =>
			new MarkdownParser({
				enableChatCodeFenceToolbar: true,
				enableMermaid: false,
				highlightTheme: getChatMarkdownHighlightTheme(appTheme),
			}),
		[appTheme],
	);

	useEffect(() => {
		const el = shellRef.current;
		if (!el) return;
		const onClick = (e: MouseEvent) => {
			const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-chat-code-action]');
			if (!btn || !el.contains(btn)) return;
			// 复制 / 下载：见应用侧 chatCodeToolbar
		};
		el.addEventListener('click', onClick);
		return () => el.removeEventListener('click', onClick);
	}, []);

	return <div ref={shellRef}>{/* StreamingMarkdownBody … */}</div>;
}
```

**流式正文组件（与仓库一致的核心结构）：**（与上文 `splitMarkdownFences` 同目录时可 `import … from './splitMarkdownFences'`；本仓库前端为 `import … from '@/utils/splitMarkdownFences'`。）

```tsx
import type { MarkdownParser } from '@dnhyxc-ai/tools';
import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react';
import { memo, type RefObject, useLayoutEffect, useMemo, useRef } from 'react';
import {
	mermaidStreamingFallbackHtml,
	splitMarkdownByCodeFences,
} from './splitMarkdownFences';

const MermaidIsland = memo(function MermaidIsland({
	code,
	preferDark,
	isStreaming,
}: {
	code: string;
	preferDark: boolean;
	isStreaming: boolean;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const genRef = useRef(0);
	/** 不参与 effect 依赖，避免停流时整岛 innerHTML 重跑导致闪屏 */
	const isStreamingRef = useRef(isStreaming);
	isStreamingRef.current = isStreaming;

	useLayoutEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		host.innerHTML =
			'<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid"></div></div>';
		const inner = host.querySelector('.mermaid') as HTMLElement | null;
		if (!inner) return;
		inner.textContent = code;

		const runId = ++genRef.current;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				if (runId !== genRef.current) return;
				void runMermaidInMarkdownRoot(host, {
					preferDark,
					suppressErrors: isStreamingRef.current,
				});
			});
		});
	}, [code, preferDark]);

	return <div ref={hostRef} className="mermaid-island-root w-full" />;
});

export function StreamingMarkdownBody({
	markdown,
	parser,
	preferDark,
	isStreaming,
	containerRef,
}: {
	markdown: string;
	parser: MarkdownParser;
	preferDark: boolean;
	isStreaming: boolean;
	containerRef?: RefObject<HTMLDivElement | null>;
}) {
	const parts = useMemo(() => splitMarkdownByCodeFences(markdown), [markdown]);

	return (
		<div ref={containerRef} className="streaming-md-body">
			{parts.map((part, i) => {
				if (part.type === 'markdown') {
					return (
						<div key={`md-${i}`} dangerouslySetInnerHTML={{ __html: parser.render(part.text) }} />
					);
				}
				if (!part.complete) {
					return (
						<div
							key={`mm-open-${i}`}
							dangerouslySetInnerHTML={{ __html: mermaidStreamingFallbackHtml(part.text) }}
						/>
					);
				}
				return (
					<MermaidIsland key={`mm-done-${i}`} code={part.text} preferDark={preferDark} isStreaming={isStreaming} />
				);
			})}
		</div>
	);
}
```

**使用处（节选）：**

```tsx
<StreamingMarkdownBody
	containerRef={bodyMarkdownRef}
	markdown={bodyText}
	parser={chatMdParser}
	preferDark={appTheme === 'black'}
	isStreaming={!!message.isStreaming}
/>
```

---

## 5. 聊天代码块工具栏（`enableChatCodeFenceToolbar`）

开启后，围栏会输出带 **`data-chat-code-action`**、**`data-chat-code-block`** 等属性的 DOM；**复制/下载逻辑与样式由应用实现**（可参考本仓库 `apps/frontend` 内 `chatCodeToolbar` 与 `index.css`）。

```ts
const parser = new MarkdownParser({
	enableChatCodeFenceToolbar: true,
	highlightTheme: 'github-dark',
});
```

---

## 6. Mermaid 围栏与占位 HTML

`enableMermaid !== false` 时，` ```mermaid ` 会生成：

```html
<div class="markdown-mermaid-wrap" data-mermaid="1">
	<div class="mermaid">…转义后的 DSL…</div>
</div>
```

插入 DOM 后由 **`useMermaidInMarkdownRoot` / `runMermaidInMarkdownRoot`** 查找并执行 **`mermaid.run`**。宿主可为 **`.markdown-mermaid-wrap`** 补充布局样式。

---

## 7. 开发与发布提示

- 修改 **`markdown-parser.ts`**、主题注入等：执行 **`pnpm --filter @dnhyxc-ai/tools run build`**。
- 修改 **`scripts/build-mk-css.js`** 或升级 **highlight.js**：需 **`build:css`**（会刷新 `src/generated/highlight-js-theme-ids.ts`），再 **`tsup`**。
- **`inject-highlight-theme.ts`** 内 **`HLJS_CDN_VERSION`** 应与 **`highlight.js` 大版本**一致（见 `docs/tools.md`）。

---

**细节与逐段源码说明仍以 [`docs/tools.md`](../../docs/tools.md) 为准；本 README 侧重「怎么用」，与前端目录对照的完整示例见 §4。**
