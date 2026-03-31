# `@dnhyxc-ai/tools` 包说明

`packages/tools` 发布为 npm 包 **`@dnhyxc-ai/tools`**，面向本 monorepo 内 **前端 / universal** 应用：提供 **Markdown → HTML** 的统一解析（代码高亮、数学公式、可选聊天代码块工具栏），以及 **打包好的样式与 KaTeX 字体**，避免各应用重复集成 `markdown-it`、`highlight.js`、`katex` 等细节。

---

## 1. 功能概览

| 能力 | 说明 |
|------|------|
| **Markdown 渲染** | 基于 [markdown-it](https://github.com/markdown-it/markdown-it)，默认开启 HTML、链接识别、排版优化、单换行转 `<br>`。 |
| **代码高亮** | 围栏代码块通过 [highlight.js](https://highlightjs.org/) 按语言高亮；未知语言则回退为转义原文。 |
| **数学公式** | [markdown-it-katex](https://github.com/waylonflinn/markdown-it-katex) + [KaTeX](https://katex.org/)；配置为失败不抛错、错误色透明，避免半段公式拖垮整页。 |
| **LaTeX 定界符扩展** | 除常见 `$...$` 外，额外支持行内 `\(...\)` 与块级 `\[...\]`（在 `markdown-parser.ts` 中通过自定义 ruler 注入）。 |
| **容器类名** | `render()` 结果外包一层 `<div class="markdown-body">`（或 `MarkdownParserOptions.containerClass` 自定义），与 GitHub Markdown CSS 对齐。 |
| **聊天代码块工具栏（可选）** | `enableChatCodeFenceToolbar: true` 时重写 `fence` 规则，输出带 `data-chat-code-block`、`data-chat-code-action` 的 DOM，供复制/下载等交互（样式由宿主应用补充，见本仓库 `ChatAssistantMessage`）。 |
| **样式导出** | 将 `github-markdown-css`、`katex.min.css` 复制到 `dist/styles/`；**highlight.js 全部 `*.min.css` 主题**复制到 `dist/styles/hljs/`（含 `base16/` 等子目录）；默认仍提供根目录 `github-dark.min.css` 与合并包 `markdown-styles.css`；另提供**不含代码配色的** `markdown-base.css`。 |
| **代码块主题选择** | 导出 `highlightJsThemes`、`highlightJsThemeIds`、`defaultHighlightJsThemeId` 与 `resolveHighlightJsThemeSpecifier()`，便于按需 `import` 某一主题 CSS。 |

**刻意不做的事：** 包内 **不自动 `import` 任何 CSS**，由使用方按页面引入，避免打包器对样式顺序与副作用失去控制（源码注释见 `packages/tools/src/markdown-parser.ts`）。

---

## 2. 公共 API

### 2.1 主入口 `@dnhyxc-ai/tools`

```ts
import { MarkdownParser, type MarkdownParserOptions } from '@dnhyxc-ai/tools';
```

- **`MarkdownParser`**：类，构造时传入选项，调用 **`render(text: string): string`** 得到 HTML 字符串。
- **`MarkdownParserOptions`**（摘录）：
  - `html`、`linkify`、`typographer`、`breaks`：透传给 `markdown-it`。
  - `containerClass`：外层包裹类名，默认 `markdown-body`。
  - `onError`：解析抛错时回调；默认行为为包一层容器并回退为原文。
  - `enableChatCodeFenceToolbar`：为 `true` 时围栏输出聊天场景工具栏结构（默认 `false`）。
  - **`highlightTheme`**：类型为 **`HighlightJsThemeId`**（由 `pnpm build:css` 生成 `src/generated/highlight-js-theme-ids.ts` 中的字面量联合，**IDE 自动补全/校验**）。在浏览器中于 **`document.head` 注入**一条指向 **jsDelivr** 上 `highlightjs/cdn-release` 的 `<link rel="stylesheet">`（版本与包内 `highlight.js` 依赖对齐，当前 `11.11.1`），**需联网**。全局仅保留一条由本包管理的主题节点，新建另一个带主题的 `MarkdownParser` 会替换上一条。
  - **`highlightThemeCss`**：直接传入主题 CSS 字符串，使用 `<style>` 注入，**优先于** `highlightTheme` 的 CDN；适用于离线、Tauri、或 `import theme from '...css?raw'`。传 **`''`** 表示只移除本包已注入的主题节点，不挂新样式。
  - **`injectHighlightTheme`**：为 `false` 时**不**做上述注入（即使传了 `highlightTheme` / `highlightThemeCss`），便于继续完全用手动 `import` 控制。

正文与公式（`github-markdown`、KaTeX）仍须通过 **`import '@dnhyxc-ai/tools/markdown-base.css'`** 或 **`styles.css`** 等方式引入；`highlightTheme*` 只负责 **代码块配色**。

也可在任意时机调用 **`applyHighlightJsTheme({ themeId, themeCss, onError })`** 或 **`clearAppliedHighlightJsTheme()`**（与构造参数行为一致，见 `inject-highlight-theme.ts`）。

### 2.2 样式相关导出（主入口与子路径）

主入口同时 re-export（来自构建期生成的 `styles` 模块）：

- **`styles`**：各 CSS 的相对路径对象，含 `githubMarkdown`、`katex`、`highlight`（默认 `github-dark`）、`combined`（完整合并）、**`markdownBase`**（正文 + 公式 + KaTeX 间距，**不含** highlight.js）。
- **`highlightJsThemes`**：`Record<string, string>`，键为主题 id（如 `github-dark`、`atom-one-dark`、`base16/zenburn`），值为包内相对路径（如 `./styles/hljs/atom-one-dark.min.css`）。
- **`highlightJsThemeIds`**：所有已打包主题的 id 列表（构建时自 `highlight.js` 样式目录扫描 `*.min.css`）。
- **`defaultHighlightJsThemeId`**：与 `markdown-styles.css` / `styles.highlight` 一致，默认为 `github-dark`。
- **`resolveHighlightJsThemeSpecifier(themeId)`**：返回形如 `@dnhyxc-ai/tools/styles/hljs/atom-one-dark.min.css` 的 **package specifier**，便于写静态 `import` 或日志提示。
- **`styleUrls`**：`styles` 的值数组（不含逐主题 hljs 路径）。
- **`styleContents`**：仅内联 **github-markdown、katex、默认 github-dark** 三份 CSS 字符串；**不会**内联全部 hljs 主题，避免 JS 体积爆炸。

**子路径（推荐在应用里引 CSS 文件）：**

| 子路径 | 指向 |
|--------|------|
| `@dnhyxc-ai/tools/styles.css` | `markdown-styles.css`（正文 + 公式 + **默认 github-dark** + KaTeX 间距），**向后兼容** |
| `@dnhyxc-ai/tools/markdown-base.css` | 正文 + 公式 + KaTeX 间距，**无**代码块配色（需再引一条 hljs 主题） |
| `@dnhyxc-ai/tools/markdown-styles.css` | 与 `styles.css` 相同 |
| `@dnhyxc-ai/tools/styles/github-markdown.css` 等 | `dist/styles/` 根下单文件 |
| `@dnhyxc-ai/tools/styles/hljs/<主题>.min.css` | 单个 highlight.js 主题（含子路径，如 `styles/hljs/base16/dracula.min.css`） |
| `@dnhyxc-ai/tools/styles` | `dist/styles.js` |

**自选代码块样式示例：**

```ts
// 方式 A：在默认合并包之后追加一条主题，利用层叠覆盖默认 github-dark
import '@dnhyxc-ai/tools/styles.css';
import '@dnhyxc-ai/tools/styles/hljs/atom-one-dark.min.css';

// 方式 B：只要一套主题，避免先加载默认暗色再覆盖
import '@dnhyxc-ai/tools/markdown-base.css';
import '@dnhyxc-ai/tools/styles/hljs/night-owl.min.css';

// 方式 C：用工具函数拼出说明符（需 bundler 能解析该静态字符串）
import { resolveHighlightJsThemeSpecifier } from '@dnhyxc-ai/tools';
void resolveHighlightJsThemeSpecifier('github-dark'); // → '@dnhyxc-ai/tools/styles/hljs/github-dark.min.css'

// 方式 D：构造 MarkdownParser 时注入代码块主题（CDN，需联网）
import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/markdown-base.css';
const parser = new MarkdownParser({ highlightTheme: 'atom-one-dark' });

// 方式 E：离线传入 CSS 字符串（配合 Vite ?raw 等）
import themeCss from '@dnhyxc-ai/tools/styles/hljs/night-owl.min.css?raw';
const parser2 = new MarkdownParser({ highlightThemeCss: themeCss });
```

手动 `import` 主题与 `highlightTheme` / `highlightThemeCss` **不要重复加载同一套 hljs**，否则易产生重复规则；若使用构造参数注入，建议正文用 **`markdown-base.css`** 或去掉合并包里的 hljs 后再由参数注入单一主题。

`package.json` 中 `sideEffects: true` 表示存在全局 CSS 等副作用；按需引入样式时仍建议显式 `import '...css'`。

### 2.3 KaTeX 字体

`scripts/build-mk-css.js` 会把 `node_modules/katex/dist/fonts/` **整目录复制到** `dist/styles/fonts/`。`katex.min.css` 内 `@font-face` 使用相对路径 `url(fonts/...)`，因此 **只要最终部署时 CSS 与 `fonts/` 目录相对位置不变**，公式字体即可加载。使用 Vite 等解析 workspace 包时，通常会把静态资源一并处理；若自行拷贝 `dist`，需同时带上 `dist/styles/fonts/`。

---

## 3. 打包与构建流程

### 3.1 脚本命令（`packages/tools/package.json`）

| 命令 | 作用 |
|------|------|
| `pnpm clean` | 删除 `dist` 与 **`src/styles.ts`**（后者为生成文件，勿手改持久内容）。 |
| `pnpm build:css` | 执行 `node scripts/build-mk-css.js`。 |
| `pnpm build` | `clean` → `build:css` → **`tsup`**。 |
| `prepack` | `pnpm build`，在 `npm pack` / `pnpm pack` 发布 tarball 前保证产物最新。 |

### 3.2 `build-mk-css.js` 做什么

1. 确保 `dist/`、`dist/styles/` 存在。
2. 复制 **github-markdown.css、katex.min.css** 到 `dist/styles/`；复制默认 **github-dark.min.css** 到 `dist/styles/`（保持旧路径 `./styles/github-dark.min.css` 可用）。
3. 将 **highlight.js `styles` 目录下全部 `*.min.css`**（含子目录，如 `base16/`）复制到 **`dist/styles/hljs/`**，并生成 **`highlightJsThemes` / `highlightJsThemeIds`** 元数据。
4. 复制 **KaTeX 字体**到 `dist/styles/fonts/`。
5. 写入 **`markdown-base.css`**：github-markdown + katex + KaTeX 间距规则（**无** hljs）。
6. 写入 **`markdown-styles.css`**：github-markdown + katex + **github-dark** + KaTeX 间距（与历史行为一致）。
7. 生成 **`dist/styles.js`**、**`dist/styles.d.ts`**、`src/styles.ts`（供 tsup 与 `@dnhyxc-ai/tools/styles` 子路径使用）。

### 3.3 `tsup`（`tsup.config.ts`）

- **入口：** `src/index.ts`。
- **产物：** `dist/index.js`（ESM）、`dist/index.cjs`（CJS）、`dist/index.d.ts`。
- **`noExternal`：** `highlight.js`、`markdown-it`、`markdown-it-katex`、`katex` 打入包内，宿主无需再单独安装这些依赖即可使用解析逻辑（样式仍建议走包的 CSS 导出）。

---

## 4. 部署与发布方式

### 4.1 Monorepo 内使用（当前主路径）

`apps/frontend`、`apps/universal` 的 `package.json` 中依赖写为：

```json
"@dnhyxc-ai/tools": "workspace:*"
```

- **安装：** 在仓库根执行 `pnpm install`，workspace 协议会把包链接到 `packages/tools`。
- **应用构建：** 前端打包（如 `pnpm -C apps/frontend build` / Tauri）会按 Vite 配置解析 `@dnhyxc-ai/tools`；请确保在改动了 `markdown-parser` 或样式脚本后，对 tools 执行一次 **`pnpm --filter @dnhyxc-ai/tools run build`**，否则 `dist` 可能过期（例如聊天代码块工具栏 HTML 结构变更后未重建）。

### 4.2 发布到 npm（可选）

1. 在 `packages/tools` 下 bump `version`。
2. 执行 `pnpm build`（或由 `prepack` 在 pack 时触发）。
3. `npm publish` / `pnpm publish`（需有对应 scope 权限）。

发布后其它项目可：

```bash
pnpm add @dnhyxc-ai/tools
```

并同样通过 `import { MarkdownParser } from '@dnhyxc-ai/tools'` 与 `import '@dnhyxc-ai/tools/styles.css'` 使用。

### 4.3 CI 建议

若 CI 中「仅安装依赖、不构建 workspace 包」即开始编译前端，可能缺少最新 `dist`。建议在流水线中增加一步：

```bash
pnpm --filter @dnhyxc-ai/tools run build
```

或在根目录用 `pnpm -r --filter @dnhyxc-ai/tools build` 等形式，再构建依赖该包的应用。

---

## 5. 在本仓库中的使用方式

| 位置 | 用法 |
|------|------|
| `apps/frontend/.../ChatAssistantMessage/index.tsx` | `new MarkdownParser({ enableChatCodeFenceToolbar: true })`，配合 `dangerouslySetInnerHTML` 与点击委托实现复制/下载（`data-chat-code-action`）。 |
| `apps/frontend/.../ChatUserMessage/index.tsx`、`session-list` | `new MarkdownParser()`，无工具栏。 |
| `apps/frontend/src/views/editor/index.tsx`、`document/index.tsx` | `MarkdownParser` + **`import '@dnhyxc-ai/tools/styles.css'`** 引入合并样式。 |
| `apps/universal/.../ChatUserMessage` | 与前端用户消息类似，默认无工具栏。 |
| `apps/frontend/src/index.css` | 注释中说明助手侧代码块工具栏与 `MarkdownParser` 输出结构的关系。 |

**样式：** 聊天相关页面若未全局引入 `styles.css`，需依赖应用其它入口（如布局或 `index.css`）已包含与 `markdown-body`、`.hljs`、`.katex` 一致的规则，否则会出现「有 HTML 无样式」或公式字体缺失。

---

## 6. 最小接入示例

```tsx
import { useMemo } from 'react';
import { MarkdownParser } from '@dnhyxc-ai/tools';
import '@dnhyxc-ai/tools/styles.css';

export function Preview({ md }: { md: string }) {
  const parser = useMemo(() => new MarkdownParser(), []);
  return (
    <div
      className="prose-wrap"
      dangerouslySetInnerHTML={{ __html: parser.render(md) }}
    />
  );
}
```

聊天场景若需要代码块工具栏，将 `useMemo` 内改为 `new MarkdownParser({ enableChatCodeFenceToolbar: true })`，并在宿主层监听 `[data-chat-code-action]`（与本仓库 `chatCodeToolbar` 工具函数一致）。

用构造参数切换代码块主题（避免再 `import` 一份 hljs）时，建议正文用 `markdown-base`，解析器里传 `highlightTheme`：

```tsx
import '@dnhyxc-ai/tools/markdown-base.css';
const parser = useMemo(
  () => new MarkdownParser({ highlightTheme: 'night-owl' }),
  [],
);
```

---

## 7. 维护说明与 `README.md`

- 包内 **`packages/tools/README.md`** 仍为早期示例片段（含已迁移走的 Toast 等），**以本文档与源码为准**。
- 修改 **`markdown-parser.ts`** 或 **`scripts/build-mk-css.js`** 后务必执行 **`pnpm --filter @dnhyxc-ai/tools run build`**。`src/generated/highlight-js-theme-ids.ts` 随 **`build:css`** 再生，升级 `highlight.js` 后应提交更新后的该文件，以便依赖方获得最新主题 id 提示。本包 `.gitignore` 忽略 **`dist/`**，本地与 **CI 在构建前端前** 需能跑到上述 build（或由 `prepack` 在发包时生成）。

---

## 8. 常见问题：未 `import '@dnhyxc-ai/tools/styles.css'` 为何仍有样式？

`@dnhyxc-ai/tools` **有意不在 JS 里自动注入** `github-markdown.css` / `katex.min.css` / `github-dark.min.css`，但 **`MarkdownParser.render()` 仍会输出带类名的 HTML**（默认外层 `markdown-body`，代码块带 `hljs`、`language-xxx`，公式带 KaTeX 结构等）。因此是否「看起来像有样式」取决于**宿主应用**还加载了什么 CSS：

1. **本仓库前端聊天区（`apps/frontend`）**  
   - `main.tsx` 全局引入了 **`apps/frontend/src/index.css`**。其中已包含与聊天 Markdown 强相关的规则，例如 **`#message-md-wrap .markdown-body`** 下的链接/排版覆盖、**`.chat-md-code-block` / `.chat-md-code-toolbar` / `.chat-md-code-block pre`** 等（见 `ChatBotView` 里消息外层的 `id="message-md-wrap"` 与 `MarkdownParser({ enableChatCodeFenceToolbar: true })` 输出的 DOM）。  
   - 这些样式**不来自** `@dnhyxc-ai/tools/styles.css`，所以聊天页即使不写该 import，**气泡、代码块容器、工具栏**仍会按主题显示正常。

2. **浏览器默认样式 + Tailwind Preflight**  
   - 标题、列表、段落、`pre`/`code` 等**语义标签**本身就有基础排版；再配合 `index.css` 里诸如 `ol, ul, menu { list-style: revert }` 等，列表等不会「完全没样式」。

3. **与「完整 tools 样式包」的差别**  
   - 未引入 `styles.css` 时，一般**不会**获得 `github-markdown-css` 的完整 GitHub 风正文排版，也**不会**获得 `github-dark.min.css` 里 **hljs 关键字配色**（高亮 DOM 里仍有 `hljs-*` class，只是没有对应颜色规则时多为默认前景色）。  
   - **KaTeX 公式**若未引入 `katex.min.css` 及字体，可能出现排版异常或字体回退；聊天若公式少，有时不易察觉。

4. **其它页面**  
   - **`editor` / `document`** 在本仓库中**显式**写了 `import '@dnhyxc-ai/tools/styles.css'`，用于需要完整 Markdown + 代码高亮主题 + 公式的场景。

**结论：** 聊天里「有样式」主要来自 **`index.css` 对聊天消息区域的定制**，而不是 tools 包的合并 CSS；若在新页面仅用 `MarkdownParser` 且没有复制这套全局规则，仍建议按需引入 `@dnhyxc-ai/tools/styles.css`（或分拆引入 `styles/github-markdown.css` 等）。

---

*路径与脚本名称以仓库 `packages/tools` 当前版本为准。*
