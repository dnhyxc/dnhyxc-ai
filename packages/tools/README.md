# `@dnhyxc-ai/tools`

Monorepo 内的 Markdown 工具包，**功能一览**：

| 能力 | 使用方式 |
| ---- | -------- |
| Markdown → HTML（GFM 风格正文、链接、换行等） | `new MarkdownParser()` + `render()`；选项见 §1。 |
| 数学公式（KaTeX） | 默认开启；需引入 **katex** 相关 CSS（如 `styles.css` / `markdown-base.css`）。 |
| 代码高亮（highlight.js） | 围栏语言名 + **`highlightTheme` / `highlightThemeCss`** 或手动 import hljs CSS。 |
| GFM 待办列表 | 内置，无需开关；样式依赖 **github-markdown-css**。 |
| 聊天围栏工具栏 | `enableChatCodeFenceToolbar: true`，宿主处理按钮事件。 |
| Mermaid 占位 + 浏览器渲染 | `enableMermaid`（默认开）+ **`@dnhyxc-ai/tools/react`**；流式整段 innerHTML 见 **`docs/tools.md` §11.9**。 |
| 标题行号 / 锚点 id | `enableHeadingSourceLineAttr` / `enableHeadingAnchorIds`。 |
| 主题 CDN / 内联 / 清除 | `applyHighlightJsTheme`、`clearAppliedHighlightJsTheme`、`resolveHighlightJsThemeSpecifier`。 |
| 样式一键引入 / 按文件引入 | `styles.css`、`markdown-base.css`、`styles/hljs/*.min.css`。 |

**更完整的架构说明、边界行为、流式聊天 Mermaid 与故障排查见 [`docs/tools.md`](../../docs/tools.md)。**

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
- **内置能力**：`html` / `linkify` / `typographer` / `breaks`（均可通过构造选项关闭或调整）、**KaTeX**（`$...$` 等 + `\(...\)` / `\[...\]`）、**highlight.js** 围栏高亮、**GFM 待办列表**（`markdown-it-task-lists` + 裸 `[x]`/`[ ]` 补丁）。

### 1.1 常用构造选项（摘录）

| 选项 | 说明 |
| ---- | ---- |
| `containerClass` | 外层包裹类名，默认 `markdown-body`。 |
| `onError` | 解析异常回调。 |
| `enableChatCodeFenceToolbar` | `true` 时围栏输出聊天用工具栏 DOM（复制/下载）；**样式与点击由宿主实现**。 |
| `highlightTheme` | **HighlightJsThemeId**，经 CDN 向 `document.head` 注入 hljs 主题（需联网）。 |
| `highlightThemeCss` | 主题 CSS 全文（离线/`?raw`）；非空优先于 `highlightTheme`。传 `''` 可仅移除本包注入节点。 |
| `injectHighlightTheme` | 默认 `true`；`false` 则完全不注入，改用手动 `import '*.css'`。 |
| `enableHeadingSourceLineAttr` | 为标题写 `data-md-heading-line`（Monaco 对齐等）。 |
| `enableHeadingAnchorIds` | 为标题写 `id`（目录锚点跳转）。 |
| `enableMermaid` | 默认 `true`：` ```mermaid ` 输出占位 DOM；`false` 则按普通代码块。与 **`@dnhyxc-ai/tools/react`** 配合渲染 SVG。 |

完整列表与默认值以 **`MarkdownParserOptions`** 类型及源码为准。

**标题预览增强**（Monaco 分屏、目录跳转）：

```ts
const parser = new MarkdownParser({
	enableHeadingSourceLineAttr: true,
	enableHeadingAnchorIds: true,
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
- **流式聊天**若对**整段正文**高频 `dangerouslySetInnerHTML`，会反复冲掉 Mermaid 的 SVG；本仓库助手消息采用 **围栏拆分 + 独立岛**（见 **`docs/tools.md` §11.9**），**不是**单靠本 hook 能根治的场景。

依赖：**`mermaid`** 已由本包 **`dependencies`** 声明；打包器需能解析 `import 'mermaid'`（Vite 可将 `@dnhyxc-ai/tools/react` 与 `mermaid` 列入 `optimizeDeps.include`）。

---

## 4. 聊天代码块工具栏（`enableChatCodeFenceToolbar`）

开启后，围栏会输出带 **`data-chat-code-action`**、**`data-chat-code-block`** 等属性的 DOM；**复制/下载逻辑与样式由应用实现**（可参考本仓库 `apps/frontend` 内 `chatCodeToolbar` 与 `index.css`）。

```ts
const parser = new MarkdownParser({
	enableChatCodeFenceToolbar: true,
	highlightTheme: 'github-dark',
});
```

---

## 5. Mermaid 围栏与占位 HTML

`enableMermaid !== false` 时，` ```mermaid ` 会生成：

```html
<div class="markdown-mermaid-wrap" data-mermaid="1">
	<div class="mermaid">…转义后的 DSL…</div>
</div>
```

插入 DOM 后由 **`useMermaidInMarkdownRoot` / `runMermaidInMarkdownRoot`** 查找并执行 **`mermaid.run`**。宿主可为 **`.markdown-mermaid-wrap`** 补充布局样式。

---

## 6. 开发与发布提示

- 修改 **`markdown-parser.ts`**、主题注入等：执行 **`pnpm --filter @dnhyxc-ai/tools run build`**。
- 修改 **`scripts/build-mk-css.js`** 或升级 **highlight.js**：需 **`build:css`**（会刷新 `src/generated/highlight-js-theme-ids.ts`），再 **`tsup`**。
- **`inject-highlight-theme.ts`** 内 **`HLJS_CDN_VERSION`** 应与 **`highlight.js` 大版本**一致（见 `docs/tools.md`）。

---

**细节与逐段源码说明仍以 [`docs/tools.md`](../../docs/tools.md) 为准；本 README 侧重「怎么用」。**
