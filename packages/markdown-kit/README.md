# @dnhyxc-ai/markdown-kit

面向应用侧的 **Markdown → HTML** 工具包：基于 [markdown-it](https://github.com/markdown-it/markdown-it) 的 `MarkdownParser`、GitHub 风格正文样式、[KaTeX](https://katex.org/) 公式、[highlight.js](https://highlightjs.org/) 代码高亮、[Mermaid](https://mermaid.js.org/) 围栏占位与浏览器内渲染，以及聊天场景下的 **代码围栏复制/下载** DOM 契约与事件绑定。

本仓库参考实现见 **`apps/frontend`**（文档页、知识库预览、聊天流式正文等）；下文示例从该应用中提炼，已改为可直接拷贝的独立代码。

---

## 安装

```bash
pnpm add @dnhyxc-ai/markdown-kit
# 或
npm install @dnhyxc-ai/markdown-kit
```

- **React 子路径** `@dnhyxc-ai/markdown-kit/react` 需要宿主安装 **peer**：`react >= 18`。
- 包内已声明 `mermaid`、`markdown-it`、`highlight.js` 等 **dependencies**，一般无需在应用里重复安装 `mermaid`（若打包器解析异常，可再在应用 `package.json` 中显式声明 `mermaid`）。

发布到 npm 的 tarball 含 **`prepack` 构建**；若你从 **git 源码** 安装，请在包目录执行一次构建：

```bash
pnpm --filter @dnhyxc-ai/markdown-kit run build
```

---

## 条件导出（子路径）

| 子路径 | 说明 |
| ------ | ---- |
| `@dnhyxc-ai/markdown-kit` | 主入口：`MarkdownParser`、`bindMarkdownCodeFenceActions`、Mermaid/围栏 DOM 常量、`applyHighlightJsTheme` 等。 |
| `@dnhyxc-ai/markdown-kit/react` | `useMermaidInMarkdownRoot`、`runMermaidInMarkdownRoot`（依赖 React）。 |
| `@dnhyxc-ai/markdown-kit/styles.css` | 合并样式：正文 + KaTeX + 默认 highlight.js 主题等。 |
| `@dnhyxc-ai/markdown-kit/markdown-base.css` | 正文 + KaTeX，**不含**完整 hljs；可再按需 `import` 单个主题 CSS。 |
| `@dnhyxc-ai/markdown-kit/styles/hljs/<主题>.min.css` | 单个 highlight.js 主题文件。 |
| `@dnhyxc-ai/markdown-kit/styles` | 运行时主题 id 列表、路径映射等（与构建产物对齐）。 |

`package.json` 中 **`sideEffects: true`**：请通过上述 CSS 入口引入样式，勿指望仅靠 tree-shaking 得到完整排版。

---

## 能力一览

| 能力 | 用法要点 |
| ---- | -------- |
| Markdown → HTML | `new MarkdownParser(options)`，再 `render(markdown)` 或 `render(markdown, { enableMermaid })`。 |
| 数学公式（KaTeX） | 默认开启；需引入含 KaTeX 的 CSS（`styles.css` 或 `markdown-base.css`）。 |
| 代码高亮 | 围栏语言名 + `highlightTheme` / `highlightThemeCss`，或手动 import `styles/hljs/*.min.css`。 |
| GFM 待办 | 内置；样式依赖 github-markdown-css。 |
| 聊天代码围栏工具栏 | `enableChatCodeFenceToolbar: true` + `bindMarkdownCodeFenceActions(根元素)`。 |
| Mermaid | 占位由 `MarkdownParser` 输出；**实际出图**用 `useMermaidInMarkdownRoot` 或 `runMermaidInMarkdownRoot`。 |
| 流式场景 Mermaid | 使用 `parser.splitForMermaidIslands` 拆块，将 mermaid 段交给独立 React 子树 + `runMermaidInMarkdownRoot`（本仓库 `MermaidFenceIsland` 为参考实现）。 |

---

## 快速开始：静态预览 + Mermaid

与 **`apps/frontend/src/views/document/index.tsx`** 一致的最小组合：**全局样式 + 解析器 + 在挂载 HTML 的根上跑 Mermaid Hook**。

```tsx
import { MarkdownParser } from '@dnhyxc-ai/markdown-kit';
import { useMermaidInMarkdownRoot } from '@dnhyxc-ai/markdown-kit/react';
import '@dnhyxc-ai/markdown-kit/styles.css';
import { useMemo, useRef } from 'react';

export function DocumentPreview({
	markdown,
	preferDark,
}: {
	markdown: string;
	preferDark: boolean;
}) {
	const rootRef = useRef<HTMLDivElement>(null);

	const parser = useMemo(
		() =>
			new MarkdownParser({
				// 与主题联动时，可映射为 'github-dark' | 'github' 等 HighlightJsThemeId
				highlightTheme: preferDark ? 'github-dark' : 'github',
			}),
		[preferDark],
	);

	useMermaidInMarkdownRoot({
		rootRef,
		preferDark,
		trigger: markdown,
		parser,
	});

	const html = useMemo(() => parser.render(markdown), [parser, markdown]);

	return (
		<div ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />
	);
}
```

要点：

- **`rootRef`** 指向与 **`dangerouslySetInnerHTML`** 同一层或包含该层的容器，保证内容写入 DOM 后 Hook 能扫描到 **`.mermaid`** 占位节点。
- **`trigger`** 使用 `markdown`（或等价的 HTML 更新信号），在正文变化时重新调度 Mermaid。

---

## 样式引入方式

**1）一键默认（适合演示与后台工具页）**

```ts
import '@dnhyxc-ai/markdown-kit/styles.css';
```

**2）正文 + KaTeX，hljs 走 CDN（与 README「1.2」类用法）**

```ts
import '@dnhyxc-ai/markdown-kit/markdown-base.css';

const parser = new MarkdownParser({
	highlightTheme: 'github-dark',
});
```

**3）离线 / Vite `?raw` 注入主题 CSS**

```ts
import css from '@dnhyxc-ai/markdown-kit/styles/hljs/night-owl.min.css?raw';
import '@dnhyxc-ai/markdown-kit/markdown-base.css';
import { MarkdownParser } from '@dnhyxc-ai/markdown-kit';

const parser = new MarkdownParser({ highlightThemeCss: css });
```

类型安全的主题 id 与包内说明符：

```ts
import type { HighlightJsThemeId } from '@dnhyxc-ai/markdown-kit';
import { resolveHighlightJsThemeSpecifier } from '@dnhyxc-ai/markdown-kit';

const id = 'atom-one-dark' satisfies HighlightJsThemeId;
const specifier = resolveHighlightJsThemeSpecifier(id);
// => @dnhyxc-ai/markdown-kit/styles/hljs/atom-one-dark.min.css
```

---

## 聊天：代码围栏工具栏 + 点击行为

与 **`apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`** 相同思路：

1. 构造 **`MarkdownParser`** 时打开 **`enableChatCodeFenceToolbar`**，并可传入 **`chatCodeFenceToolbarTexts`**（复制/下载按钮文案）。
2. 在挂载正文的 **祖先容器** 上调用 **`bindMarkdownCodeFenceActions`**，在 `onDownload` 里落盘或走业务下载逻辑。

```tsx
import {
	bindMarkdownCodeFenceActions,
	MarkdownParser,
} from '@dnhyxc-ai/markdown-kit';
import { useEffect, useMemo, useRef } from 'react';

export function ChatMarkdownShell({
	markdownHtml,
}: {
	markdownHtml: string;
}) {
	const shellRef = useRef<HTMLDivElement>(null);

	const parser = useMemo(
		() =>
			new MarkdownParser({
				enableChatCodeFenceToolbar: true,
				chatCodeFenceToolbarTexts: { copy: '复制', download: '下载' },
				// 聊天流式场景下 Mermaid 常由「岛」单独渲染，此处可关闭解析器内的 mermaid 占位
				enableMermaid: false,
				highlightTheme: 'github-dark',
			}),
		[],
	);

	useEffect(() => {
		const el = shellRef.current;
		if (!el) return;
		return bindMarkdownCodeFenceActions(el, {
			onDownload(payload) {
				// payload.block / payload.lang 等与 MARKDOWN_CODE_FENCE_* 契约一致
				console.log('download', payload.lang);
			},
		});
	}, []);

	return (
		<div ref={shellRef} dangerouslySetInnerHTML={{ __html: markdownHtml }} />
	);
}
```

正文 HTML 仍由 **`parser.render(原始 markdown)`** 生成（上例为传入已渲染的 `markdownHtml` 仅作挂载演示）。需要与 **选择器/DOM 结构** 强一致时，请从主入口 import **`MARKDOWN_CODE_FENCE_*`**、`queryMarkdownCodeFenceBlockRoots` 等，避免手写魔法字符串。

---

## Mermaid：整段扫描 vs 流式「拆岛」

**整段 `innerHTML` + 根扫描**（适合文档、非流式）：上文「快速开始」的 **`useMermaidInMarkdownRoot`** 即可。

**流式聊天**（与 **`StreamingMarkdownBody`** / **`MermaidFenceIsland`** 一致的设计要点）：

1. 使用 **`parser.splitForMermaidIslands(source)`** 得到 **`MarkdownMermaidSplitPart[]`**，将 **`type: 'mermaid'`** 的块交给独立组件。
2. 在岛内用 **`normalizeMermaidFenceBody`** 预处理 DSL，用 **`MARKDOWN_MERMAID_PLACEHOLDER_HTML`** 等与解析器 **同构** 的占位结构写入 DOM，再调用 **`runMermaidInMarkdownRoot(hostElement, { preferDark, suppressErrors })`**（从 **`@dnhyxc-ai/markdown-kit/react`** 导入）。
3. 对未闭合围栏的尾部，可结合应用侧按行围栏解析（本仓库 `splitForMermaidIslandsWithOpenTail` 在 `apps/frontend/src/utils/splitMarkdownFences.ts`）将 **开放尾部的 mermaid** 单独成块，避免整段 HTML 频繁替换冲掉已渲染 SVG。

极简「仅调用命令式 API」示例：

```tsx
import { MARKDOWN_MERMAID_PLACEHOLDER_HTML } from '@dnhyxc-ai/markdown-kit';
import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/markdown-kit/react';
import { useLayoutEffect, useRef } from 'react';

export function MermaidHost({ code, preferDark }: { code: string; preferDark: boolean }) {
	const ref = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const host = ref.current;
		if (!host) return;
		host.innerHTML = MARKDOWN_MERMAID_PLACEHOLDER_HTML;
		void runMermaidInMarkdownRoot(host, { preferDark, suppressErrors: true });
	}, [code, preferDark]);

	return <div ref={ref} />;
}
```

---

## Monaco 分屏：标题行号属性

与 **`ParserMarkdownPreviewPane`**（`apps/frontend/src/components/design/Markdown/index.tsx`）一致，开启 **`enableHeadingSourceLineAttr: true`** 后，预览标题会带 **`data-md-heading-line`**（1-based 行号），便于与编辑器滚动对齐。

```ts
const parser = new MarkdownParser({
	enableHeadingSourceLineAttr: true,
	highlightTheme: 'github-dark',
	enableChatCodeFenceToolbar: true,
});
```

---

## Vite 预构建（与本仓库 `vite.config.ts` 一致）

开发态下可将 **`@dnhyxc-ai/markdown-kit/react`** 与 **`mermaid`** 放入 **`optimizeDeps.include`**，减少首次预构建抖动：

```ts
// vite.config.ts
export default defineConfig({
	optimizeDeps: {
		include: ['@dnhyxc-ai/markdown-kit/react', 'mermaid'],
	},
});
```

若升级包后遇到 **`Importing binding ... is not found`**，可清理 `node_modules/.vite` 后加 **`--force`**，或对子路径尝试 **`optimizeDeps.exclude`**。

---

## 安全说明（XSS）

`MarkdownParser` 默认 **`html: false`**，不信任 Markdown 中的原始 HTML 标签。若业务显式 **`html: true`**，请务必在挂载前对 HTML 做 **sanitize（清洗）**（白名单标签/属性），再写入 `innerHTML` / `dangerouslySetInnerHTML`。

---

## 更多文档

- 本包仓库内 **`INFO.md`**：更长的 API 表、主题元数据、故障排查与流式 Mermaid 架构说明（面向 monorepo 维护者）。
- 应用层完整交互（吸顶工具条、预览缩放等）在 **`apps/frontend`**，不在本 npm 包内导出。

---

## License

以发布该包时所附 **根仓库** 的许可证声明为准（若单独发包，请同步维护本节的 SPDX 与版权信息）。
