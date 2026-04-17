# `@dnhyxc-ai/tools` 使用指南

这是一份面向**使用者**的文档，目标不是解释内部实现，而是回答三个问题：

1. 这个包能做什么？
2. 我应该怎么接入？
3. 不同场景下该怎么选参数与导入方式？

如果你想看内部实现、边界行为、构建与源码结构，请再阅读 `docs/tools.md`；如果你只想“像用 npm 包一样快速上手”，看本文即可。

---

## 1. 这个包能做什么

`@dnhyxc-ai/tools` 主要提供以下能力：

- **Markdown → HTML**：通过 `MarkdownParser` 将 Markdown 渲染为 HTML 字符串
- **数学公式（KaTeX）**：默认支持 `$...$`、`\(...\)`、`\[...\]`
- **代码高亮（highlight.js）**：支持手动 CSS、CDN 注入、内联 CSS 三种主题接入方式
- **GFM 待办列表**：支持 `- [ ]` / `- [x]`
- **Mermaid 图表**：支持在 Markdown 中写 ` ```mermaid `，并在浏览器中渲染成 SVG
- **聊天代码块工具栏**：可为代码块输出复制/下载等工具栏 DOM
- **标题增强**：可为标题写入源码行号、锚点 id，便于目录和编辑器联动

---

## 2. 安装与构建

在 monorepo 中使用：

```json
"@dnhyxc-ai/tools": "workspace:*"
```

然后在根目录执行：

```bash
pnpm install
```

如果你修改了 `packages/tools/src/**` 源码，还需要执行：

```bash
pnpm --filter @dnhyxc-ai/tools run build
```

这是因为应用运行时消费的是 `dist/` 构建产物；只改源码不 build，前端仍可能跑旧逻辑。

---

## 3. 你会用到哪些导出

最常用的子路径如下：

| 导入路径                                       | 用途                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------- |
| `@dnhyxc-ai/tools`                             | 主入口：`MarkdownParser`、主题 API、样式元数据；以及 **Mermaid 占位 DOM 契约**相关常量/helper（如 `MERMAID_MARKDOWN_ENTRY_SELECTOR`、`closestMermaidMarkdownWrap` 等，见 **§8.5**） |
| `@dnhyxc-ai/tools/react`                       | React 侧 Mermaid 渲染：`useMermaidInMarkdownRoot`、`runMermaidInMarkdownRoot` |
| `@dnhyxc-ai/tools/styles.css`                  | 一次引入正文 + KaTeX + 默认高亮主题                                           |
| `@dnhyxc-ai/tools/markdown-base.css`           | 仅正文 + KaTeX，不含完整 hljs 配色                                            |
| `@dnhyxc-ai/tools/styles/hljs/<theme>.min.css` | 单个 highlight.js 主题文件                                                    |

---

## 4. 最小可用示例

这是最简单、最推荐的起步方式：

```tsx
import { MarkdownParser } from "@dnhyxc-ai/tools";
import "@dnhyxc-ai/tools/styles.css";

const parser = new MarkdownParser({
	// 已手动引入 styles.css 时，建议关闭运行时 hljs 注入，避免重复
	injectHighlightTheme: false,
});

const html = parser.render("# 标题\n\n这是一段 **Markdown**");

document.getElementById("preview")!.innerHTML = html;
```

这段代码已经具备：

- Markdown 正文样式
- KaTeX 公式样式
- 默认代码高亮主题
- GFM 待办列表
- raw HTML 默认关闭（更安全）

---

## 5. `MarkdownParser` 怎么用

### 5.1 基础写法

```ts
import { MarkdownParser } from "@dnhyxc-ai/tools";

const parser = new MarkdownParser();
const html = parser.render(markdown);
```

### 5.2 `render(text)` 返回什么

`render(text)` 返回的是**完整 HTML 字符串**，并且会自动包一层外层容器：

```html
<div class="markdown-body">...</div>
```

默认 class 是 `markdown-body`，便于直接配合 `github-markdown-css` 风格样式。

### 5.3 安全说明：raw HTML 默认关闭

`html` 默认是 `false`。这意味着：

- `<script>alert(1)</script>` 不会执行
- `<div>hello</div>` 不会被当作标签渲染
- 它们会被转义为普通文本

如果你确实要支持少量 HTML，可以显式开启：

```ts
const parser = new MarkdownParser({
	html: true,
});
```

但务必注意：

- 若最终用 `innerHTML` / `dangerouslySetInnerHTML` 挂载
- 且输入内容不是完全可信

那么开启 `html: true` 会引入 **XSS（跨站脚本攻击）** 风险。此时应在宿主侧做 **sanitize（清洗）** 白名单。

---

## 6. 常见接入方式

### 6.1 方式一：直接引完整样式

适合快速接入、最少配置：

```tsx
import { MarkdownParser } from "@dnhyxc-ai/tools";
import "@dnhyxc-ai/tools/styles.css";

const parser = new MarkdownParser({
	injectHighlightTheme: false,
});
```

特点：

- 最省事
- 一次拿到正文 + KaTeX + 默认高亮
- 适合聊天、文档页、预览页

### 6.2 方式二：只引基础样式，主题走 CDN

```tsx
import { MarkdownParser } from "@dnhyxc-ai/tools";
import "@dnhyxc-ai/tools/markdown-base.css";

const parser = new MarkdownParser({
	highlightTheme: "github-dark",
});
```

特点：

- 正文与公式样式走本地
- 代码高亮主题运行时注入 CDN `<link>`
- 适合希望按 UI 主题动态切换高亮方案的页面

### 6.3 方式三：离线 / Tauri / `?raw` 内联主题

```tsx
import css from "@dnhyxc-ai/tools/styles/hljs/night-owl.min.css?raw";
import { MarkdownParser } from "@dnhyxc-ai/tools";
import "@dnhyxc-ai/tools/markdown-base.css";

const parser = new MarkdownParser({
	highlightThemeCss: css,
});
```

特点：

- 不依赖外网
- 更适合桌面端 / 离线环境
- 若同时传 `highlightThemeCss` 与 `highlightTheme`，前者优先

---

## 7. `MarkdownParserOptions` 该怎么选

下面只讲“用户最关心的怎么选”，完整字段说明见 `packages/tools/README.md`。

### 7.1 安全优先场景

例如聊天消息、用户可编辑内容、外部文档预览：

```ts
const parser = new MarkdownParser({
	html: false,
});
```

建议：

- 保持 `html: false`
- 只有必要时才打开 `html: true`

### 7.2 需要自动识别裸链接

默认就是开着的：

```ts
const parser = new MarkdownParser({
	linkify: true,
});
```

若你不想把纯文本 URL 自动转成链接，可以关掉：

```ts
const parser = new MarkdownParser({
	linkify: false,
});
```

### 7.3 需要目录锚点 / 标题跳转

```ts
const parser = new MarkdownParser();
```

这里可以**不传参数**，原因是：

- `MarkdownParser` 现在默认会把 `enableHeadingAnchorIds` 视为开启状态
- 渲染标题时会自动为每个标题生成 `id`
- 这些 `id` 会按标题文本做 slug 化，并在重复标题时自动追加 `-1`、`-2` 等后缀避免冲突

因此只要你直接：

```ts
const parser = new MarkdownParser();
```

生成的 HTML 标题通常就已经是类似下面的结构：

```html
<h2 id="快速开始">快速开始</h2>
```

这也是为什么你可以直接使用：

- `[跳到快速开始](#快速开始)`
- 目录组件中的锚点跳转
- 浏览器地址栏 hash 定位

只有在你**明确不希望输出标题 `id`** 时，才需要显式关闭：

```ts
const parser = new MarkdownParser({
	enableHeadingAnchorIds: false,
});
```

### 7.4 需要与 Monaco 标题滚动联动

```ts
const parser = new MarkdownParser({
	enableHeadingSourceLineAttr: true,
});
```

### 7.5 需要统一代码块缩进（Tab 展开）

默认会把代码块里的 `\t`（Tab，制表符）展开为 **2 个空格**，一般可不传参数。

如果你希望改成 4 个空格，或完全保留 Tab：

```ts
const parser = new MarkdownParser({
	codeBlockTabSize: 4, // 每个 \t -> 4 个空格
	// codeBlockTabSize: 0, // 保留 \t，不展开
});
```

### 7.6 需要聊天代码块工具栏

```ts
const parser = new MarkdownParser({
	enableChatCodeFenceToolbar: true,
});
```

注意：

- 这只会输出工具栏 DOM
- 但现在推荐直接配合 `bindMarkdownCodeFenceActions(...)`，无需宿主自己手写 `querySelector('pre code')`

下面是**推荐写法**：直接使用工具包内置的代码块动作绑定器。

```tsx
import { useEffect, useRef } from 'react';
import {
	bindMarkdownCodeFenceActions,
	MarkdownParser,
} from '@dnhyxc-ai/tools';

export function MarkdownWithCodeToolbar({ markdown }: { markdown: string }) {
	const rootRef = useRef<HTMLDivElement>(null);
	const parser = new MarkdownParser({
		enableChatCodeFenceToolbar: true,
	});

	useEffect(() => {
		const root = rootRef.current;
		if (!root) return;
		// 推荐：显式传 root，把事件作用域限制在当前容器内，避免跨页面/跨组件串扰
		const dispose = bindMarkdownCodeFenceActions(root, {
			onDownload(payload) {
				// 工具内部已经帮你拿到代码内容、语言、文件名建议
				console.log(payload.code, payload.lang, payload.filename);
			},
		});
		return dispose;
	}, []);

	return (
		<div
			ref={rootRef}
			dangerouslySetInnerHTML={{ __html: parser.render(markdown) }}
		/>
	);
}
```

实现要点：

- 按钮由 `enableChatCodeFenceToolbar: true` 生成，内部会带 `data-chat-code-action="copy|download"`。
- `bindMarkdownCodeFenceActions(root, options)` 是现在的**推荐用法**：把监听限制在当前渲染容器，避免不同页面/组件都绑到 `document` 后互相“抢处理”。
- 默认会处理：
  - 复制到剪贴板
  - 按钮切换为 `已复制`，并在短暂延迟后恢复
- 业务方通常只需要关心 `onDownload(payload)`，不再需要自己手动查找 `pre code`。
- 也支持 `bindMarkdownCodeFenceActions(options)`（省略 root）：会默认绑定到 `document`。**仅建议在你明确只有一个宿主容器、且不会出现多个实例并存的页面使用**。

### 7.6.0 Markdown 围栏代码块 DOM 契约（`MARKDOWN_CODE_FENCE_*`）

若你在 **聊天 / 知识库 / 自定义预览** 里用 `querySelector` 或浮动布局去碰 **`[data-chat-code-block]`**、**`.chat-md-code-toolbar`** 等，请优先从 **`@dnhyxc-ai/tools`** 引用 **`markdown-code-fence-dom`** 导出的 **`MARKDOWN_CODE_FENCE_*`**，与 **`MarkdownParser`**、**`bindMarkdownCodeFenceActions`** **同源**，避免解析器改占位后漏改宿主。

```ts
import {
	MARKDOWN_CODE_FENCE_BLOCK_ROOT_SELECTOR, // 根：`[data-chat-code-block]`
	MARKDOWN_CODE_FENCE_TOOLBAR_SELECTOR, // 行内工具栏：`.chat-md-code-toolbar`
	queryMarkdownCodeFenceBlockRoots, // 在容器子树内收集所有根节点
} from '@dnhyxc-ai/tools';

function scanFenceRoots(container: HTMLElement) {
	return queryMarkdownCodeFenceBlockRoots(container); // 等价于手写 querySelectorAll(MARKDOWN_CODE_FENCE_BLOCK_ROOT_SELECTOR)
}
```

**实现思路、维护约定、带行尾 `//` 注释的源码摘录（含 `markdown-parser` / `chatCodeToolbar` 节选）**：见 [`tools.md`](./tools.md) **第 11.8.6.0 小节**。

### 7.6.1 下载逻辑：推荐把“落盘”交给宿主，把“内容/文件名”交给工具包

很多项目的下载实现不一致（Web / Tauri / Electron），因此工具包提供 `downloadMarkdownCodeFenceWith`：

- 工具包负责：把 `payload.code` 组装为 `Blob`，并给出 `filename`、`lang` 等元信息
- 宿主负责：用自己的下载器把 `Blob` 写出去（例如 `downloadBlob`、原生文件 API 等）

示例（伪代码，按你项目的 `downloadBlob` 替换即可）：

```ts
import {
	bindMarkdownCodeFenceActions,
	downloadMarkdownCodeFenceWith,
} from "@dnhyxc-ai/tools";

bindMarkdownCodeFenceActions(root, {
	onDownload(payload) {
		void downloadMarkdownCodeFenceWith(payload, async (task) => {
			// task.blob / task.filename 已准备好，宿主只负责“怎么保存”
			console.log(task.filename, task.blob.size);
		});
	},
});
```

---

## 7.x 本轮补充：避免为 `enableMermaid` 重复 new parser

在一些页面（例如 Monaco 预览）你可能既需要：

- **整段渲染时**允许把 ```mermaid 输出为占位 DOM（给 `useMermaidInMarkdownRoot` 扫描渲染 SVG）
- **拆分 Mermaid 岛布局时**对 markdown 段禁用 Mermaid 占位（避免重复渲染）

此时不建议 `new MarkdownParser()` 两次。你可以只保留一个实例，并在本次 `render()` 时覆盖：

```ts
const parser = new MarkdownParser({
	// 这里放“稳定配置”：主题、工具栏、标题行号等
	enableChatCodeFenceToolbar: true,
	enableHeadingSourceLineAttr: true,
});

// 整段渲染：本次允许 Mermaid
const htmlAll = parser.render(markdown, { enableMermaid: true });

// 拆分布局下的 markdown 段：本次禁用 Mermaid
const htmlPart = parser.render(partMarkdown, { enableMermaid: false });
```
- 外层代码块容器带 `data-chat-code-block`，可以据此向上查找，再从 `pre code` 里取源码文本。
- 下载文件名可按语言动态生成，例如：
  - `ts` → `code.ts`
  - `python` → `code.python`
  - 无语言时可回退为 `code.txt`
- 如果你的项目有自己的复制提示（Toast）或下载工具函数，也可以把上面的 `navigator.clipboard.writeText` / `downloadTextFile` 替换成项目封装。

### 7.6 需要 Mermaid 占位

```ts
const parser = new MarkdownParser({
	enableMermaid: true,
});
```

注意：

- 这一步只是输出 Mermaid 占位 HTML
- 真正渲染成 SVG 还需要 `@dnhyxc-ai/tools/react`

---

## 8. Mermaid 怎么用

### 8.1 React 页面：推荐用 `useMermaidInMarkdownRoot`

```tsx
import { MarkdownParser } from "@dnhyxc-ai/tools";
import { useMermaidInMarkdownRoot } from "@dnhyxc-ai/tools/react";
import { useMemo, useRef } from "react";

export function Preview({
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
				enableMermaid: true,
			}),
		[],
	);

	const html = useMemo(() => parser.render(markdown), [parser, markdown]);

	useMermaidInMarkdownRoot({
		rootRef,
		preferDark,
		trigger: html,
		parser,
	});

	return <div ref={rootRef} dangerouslySetInnerHTML={{ __html: html }} />;
}
```

### 8.2 高频更新场景：加节流

例如编辑器预览、流式输出：

```tsx
useMermaidInMarkdownRoot({
	rootRef,
	preferDark,
	trigger: html,
	parser,
	throttleMs: 280,
});
```

这样可以减少 `mermaid.run` 次数，降低抖动。

### 8.3 非 React 场景：直接手动调用

```ts
import { runMermaidInMarkdownRoot } from "@dnhyxc-ai/tools/react";

await runMermaidInMarkdownRoot(document.getElementById("preview-root"), {
	preferDark: true,
	suppressErrors: false,
});
```

### 8.4 流式聊天场景的注意事项

如果你在流式消息里**反复整段替换 `dangerouslySetInnerHTML`**，Mermaid 已生成的 SVG 会被冲掉。  
这种场景不建议只靠 `useMermaidInMarkdownRoot`，而应使用：

- 围栏拆分
- Mermaid 独立岛
- 或本仓库中的 `splitMarkdownFences` + `StreamingMarkdownBody` 方案

更完整说明见 `docs/tools.md`。

### 8.5 Mermaid：不要手写 `.markdown-mermaid-wrap …` 选择器（推荐）

**背景**：Mermaid 占位结构由 `MarkdownParser` / 前端岛共同约定（wrap + `data-mermaid="1"` + 内层 `.mermaid`）。若业务代码到处 `querySelector('.markdown-mermaid-wrap .mermaid')`，未来调整 DOM 时很容易漏改。

**推荐做法**：从 **`@dnhyxc-ai/tools`** 直接 import 契约常量/helper（与解析器、运行时扫描 **同源**）。

**完整实现源码（每行行尾 `//` 中文注释）**：见 `docs/tools.md` **§11.2.2**（工具包 + 前端岛 + Hook + 工具栏节选）。

下面示例同样采用 **行尾注释**（便于复制到业务代码后仍可读）：

```ts
import {
	MERMAID_MARKDOWN_SVG_SELECTOR, // 已渲染 SVG：`.markdown-mermaid-wrap[data-mermaid="1"] .mermaid svg`
	MERMAID_MARKDOWN_ENTRY_SELECTOR, // mermaid.run 扫描入口选择器字符串（调试用 / 动态样式等）
	closestMermaidMarkdownWrap, // 从任意元素向上找契约 wrap（含 data-mermaid="1"）
	MERMAID_ENTRY_SELECTOR, // `.mermaid`：用于在已知 wrap 内拼 `${MERMAID_ENTRY_SELECTOR} svg`
	MARKDOWN_MERMAID_PLACEHOLDER_HTML, // 空壳占位 HTML：与解析器输出同构
	MARKDOWN_MERMAID_TAILWIND_CURSOR_ZOOM_IN_CLASS, // Tailwind arbitrary class：cursor-zoom-in
} from "@dnhyxc-ai/tools"; // 主入口聚合导出：避免业务侧散落选择器字符串

// 示例 1：在某个 scope 根下取已渲染 SVG（预览/下载）
const svg = scope.querySelector(MERMAID_MARKDOWN_SVG_SELECTOR); // 等价于手写长选择器，但随工具包契约自动更新

// 示例 2：点击委托：从事件目标向上找 wrap（要求带 data-mermaid="1"）
const wrap = closestMermaidMarkdownWrap(target); // 比 closest('.markdown-mermaid-wrap') 更严格，避免误命中半截 DOM
const svg2 = wrap?.querySelector(`${MERMAID_ENTRY_SELECTOR} svg`); // 在 wrap 内取 svg：与 MERMAID_MARKDOWN_SVG_SELECTOR 语义一致（仅前缀不同）

// 示例 3：初始化空壳 DOM（岛内/离屏），避免手写 HTML 字符串
host.innerHTML = MARKDOWN_MERMAID_PLACEHOLDER_HTML; // innerHTML 一次性写入 wrap>.mermaid 结构

// 示例 4：Tailwind 任意选择器（cursor），避免手写 [&_.…_.…] 拼错
const cls = MARKDOWN_MERMAID_TAILWIND_CURSOR_ZOOM_IN_CLASS; // 直接拼进 className={cn(...)} 即可
```

**边界**：若你自行拼接 Mermaid DOM，请确保与 **`MERMAID_MARKDOWN_ENTRY_SELECTOR`** 一致；尤其是 **`data-mermaid="1"`** 缺失会导致扫描/预览取图失败。

**更完整的架构说明**：`docs/tools.md` **§11.2.1**、`docs/mermaid-markdown-zoom-and-preview.md`。

---

## 9. 主题相关 API 怎么用

### 9.1 运行时注入主题

```ts
import { applyHighlightJsTheme } from "@dnhyxc-ai/tools";

applyHighlightJsTheme({
	themeId: "github-dark",
});
```

### 9.2 清除当前注入的主题

```ts
import { clearAppliedHighlightJsTheme } from "@dnhyxc-ai/tools";

clearAppliedHighlightJsTheme();
```

### 9.3 获取单个主题文件的导入路径

```ts
import type { HighlightJsThemeId } from "@dnhyxc-ai/tools";
import { resolveHighlightJsThemeSpecifier } from "@dnhyxc-ai/tools";

const id: HighlightJsThemeId = "atom-one-dark";
const spec = resolveHighlightJsThemeSpecifier(id);
// => @dnhyxc-ai/tools/styles/hljs/atom-one-dark.min.css
```

---

## 10. 常见问题

### 10.1 为什么改了 `packages/tools/src/**`，页面没生效？

因为运行时使用的是 `dist/`：

```bash
pnpm --filter @dnhyxc-ai/tools run build
```

### 10.2 为什么代码块没颜色？

通常是以下原因之一：

- 没有引入 `styles.css`
- 没有引入 `markdown-base.css` + 某个 hljs 主题
- 关闭了 `injectHighlightTheme`，但又没有手动导入主题 CSS

### 10.3 为什么 Mermaid 不出图？

先检查：

1. `MarkdownParser({ enableMermaid: true })` 是否开启
2. `dangerouslySetInnerHTML` 后是否调用了 `useMermaidInMarkdownRoot`
3. `rootRef` 是否指向正确 DOM
4. `trigger` 是否真的随着内容变化

### 10.4 为什么 raw HTML 没有渲染？

因为 `html` 默认是 `false`。若你想允许：

```ts
const parser = new MarkdownParser({
	html: true,
});
```

但要自己承担安全风险，并建议做清洗。

---

## 11. 推荐阅读顺序

如果你第一次接入，建议按这个顺序看：

1. 本文：先跑通最小示例
2. `packages/tools/README.md`：看参数与完整代码示例
3. `docs/tools.md`：看实现原理、架构、边界行为、流式 Mermaid 方案

---

## 12. 与本仓库前端对应的真实示例

你可以直接对照这些文件：

- `apps/frontend/src/components/design/ChatUserMessage/index.tsx`
- `apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`
- `apps/frontend/src/views/chat/session-list/index.tsx`
- `apps/frontend/src/views/document/index.tsx`
- `apps/frontend/src/components/design/Monaco/preview.tsx`
- `apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx`
- `apps/frontend/src/utils/splitMarkdownFences.ts`

这些文件展示了：

- 普通 Markdown 预览
- 聊天消息渲染
- 会话列表摘要渲染
- Mermaid 在文档页与 Monaco 中的接入
- 流式 Mermaid 的拆块与独立岛方案
