# `@dnhyxc-ai/tools` 包说明（功能、实现与用法）

`packages/tools` 发布为 **`@dnhyxc-ai/tools`**，供本 monorepo 内前端 / universal 使用。核心交付物是：**Markdown → HTML 解析器（`MarkdownParser`）**、**可打包的 Markdown/KaTeX/highlight.js 样式与字体**、以及 **highlight.js 主题的「类型安全 id + 多路径消费（import / CDN / 内联）」**。

---

## 1. 源码与产物结构

| 路径                                      | 角色                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/markdown-parser.ts`                  | `MarkdownIt` + `markdown-it-katex` + **`markdown-it-task-lists`（GFM 待办）** + 自研「纯 `[x]`/`[ ]`」补丁 + `highlight.js` 高亮；可选围栏工具栏；构造末尾调用主题注入。 |
| `src/types.d.ts`                          | 为无官方类型的依赖补充 `declare module`（如 `markdown-it-katex`、`markdown-it-task-lists`）。                         |
| `src/inject-highlight-theme.ts`           | `applyHighlightJsTheme` / `clearAppliedHighlightJsTheme`：向 `document.head` 注入 `<link>`（CDN）或 `<style>`（内联）。 |
| `src/highlight-theme-import.ts`           | `resolveHighlightJsThemeSpecifier`：把主题 id 转成 `@dnhyxc-ai/tools/styles/hljs/...` 包内说明符。                      |
| `src/generated/highlight-js-theme-ids.ts` | **构建生成**：`HighlightJsThemeId` 字面量联合，与 `dist/styles/hljs` 下文件一一对应。                                   |
| `src/styles.ts`                           | **构建生成**：`highlightJsThemes`、`highlightJsThemeIds`、`styleContents`、`styles` 等（`pnpm clean` 会删，勿手改）。   |
| `src/index.ts`                            | 包入口：聚合导出类型与函数。                                                                                            |
| `scripts/build-mk-css.js`                 | 复制 CSS/字体、写合并文件、写 `dist/styles.js` / `styles.d.ts` / `src/styles.ts`、写 `highlight-js-theme-ids.ts`。      |
| `tsup.config.ts`                          | 打 `dist/index.{js,cjs}` + `d.ts`；**第二入口** `dist/react/index.{js,cjs}`（Mermaid + React hook）；`noExternal` 打入 `highlight.js` / `markdown-it` / `markdown-it-katex` / `katex`；**`markdown-it-task-lists` 保持外部 import**（见 §6.3、§10）；**`mermaid` 在 react 入口为 external**（见 §11）。 |
| `src/mermaid-in-markdown.ts`              | 浏览器内对占位 DOM 调用 `mermaid.initialize` / `mermaid.run`，串行队列防并发。                                                                 |
| `src/react/use-mermaid-in-markdown-root.ts` | React：`useLayoutEffect` + 双 `requestAnimationFrame` 后调用上述函数。                                                                        |
| `src/react/index.ts`                      | 子路径 **`@dnhyxc-ai/tools/react`**：导出 `useMermaidInMarkdownRoot`、`runMermaidInMarkdownRoot` 及类型。                                      |
| `dist/styles/**`                          | 运行时样式产物（`dist/` 默认不提交，由 CI/本地 `pnpm build` 生成）。                                                    |

---

## 2. 功能清单与实现方式

### 2.1 Markdown 渲染与容器

- **实现**：`MarkdownIt` 实例，默认 `linkify/typographer/breaks` 与项目需求对齐；出于安全考虑 **`html`（raw HTML）默认关闭**（避免 `<script>` 等被原样输出，宿主 `innerHTML` 挂载时引入 XSS 面）。
- **GFM 待办**：在 KaTeX 之后注册 `markdown-it-task-lists`，再注册自研 `patchGfmTaskListBareMarkers`（见 **§10**）。有序 / 无序列表中的 `- [ ] foo`、`- [x] bar`、`1. [ ]` 等会输出带 `contains-task-list`、`task-list-item`、`task-list-item-checkbox` 的 HTML，与 `github-markdown-css` 中任务列表样式一致。
- **输出**：`render(text)` 内先对 `\text{○}` 做替换以规避 KaTeX 度量问题，再 `md.render`，外层包 `<div class="${containerClass}">`（默认 `markdown-body`），便于配合 `github-markdown-css`。
- **错误**：`try/catch` 中调用可选 `onError`，失败时仍包容器并回退为转义前的原文占位。

#### 2.1.1 安全设计：为什么默认关闭 `html`

**背景**：Markdown 渲染通常会把输出 HTML 字符串交给宿主通过 `innerHTML`（原生）或 `dangerouslySetInnerHTML`（React）挂载。若解析器允许 raw HTML，用户只要输入如下内容：

```html
<script>alert("XSS Attack! Your cookie is: " + document.cookie)</script>
```

就可能在挂载时触发 **XSS（跨站脚本攻击）**。

**策略**：本项目将 `MarkdownIt({ html })` 的默认值调整为 `false`，让 raw HTML 一律被转义为文本（例如输出 `&lt;script&gt;...`），从源头收敛风险面。

**注意**：

- 若业务确实需要少量 HTML（例如 `details/summary`），请显式传 `new MarkdownParser({ html: true })`，并在宿主侧对输出做 **sanitize（清洗）**（建议白名单，仅放行必要标签/属性）。
- 仅开启 `html: true` 但不做清洗，在任何使用 `innerHTML` 的界面都是高风险配置。

#### 2.1.2 落地建议：按业务需要显式配置 `html`

本工具包默认 `html: false`（raw HTML 作为文本转义输出）。因此多数业务场景**无需显式传 `html: false`** 也能保持安全默认。

如确需支持少量 HTML（例如 `details/summary`），再显式传 `new MarkdownParser({ html: true })`，并强烈建议在宿主侧做 **sanitize（清洗）** 白名单。

> 重要：本仓库 `@dnhyxc-ai/tools` 通过 `tsup` 构建输出 `dist/`，前端运行时消费的是 `dist` 产物。  
> 因此若你修改了 `packages/tools/src/markdown-parser.ts` 的默认行为，需要执行 `pnpm --filter @dnhyxc-ai/tools run build` 让 `dist` 刷新，否则应用可能仍使用旧逻辑。

### 2.2 代码高亮（highlight.js）

- **实现**：`markdown-it` 的 `highlight(str, lang)` 回调里调用 `hljs.getLanguage` + `hljs.highlight`；失败返回 `''`，后续由 markdown-it 走默认转义路径。
- **与主题的关系**：高亮生成的是带 `hljs`、各类 `hljs-*` class 的 HTML；**颜色完全由 CSS 决定**。主题来源三选一：**手动 import 某 `.min.css`**、**CDN `<link>`（`highlightTheme`）**、**内联 `<style>`（`highlightThemeCss`）**。

### 2.3 数学公式（KaTeX）

- **实现**：`markdown-it-katex`，`throwOnError: false`、`displayMode: false`、`strict: 'ignore'`、`errorColor: 'transparent'`，避免半段公式阻断整页。
- **定界符扩展**：`addLatexDelimiters()` 向 `md.inline.ruler` / `md.block.ruler` 注册规则，支持 `\(...\)` 与 `\[...\]`（在标准 `$` 之外）。

### 2.4 聊天围栏代码块工具栏（可选）

- **开关**：`enableChatCodeFenceToolbar: true`。
- **实现**：覆盖 `md.renderer.rules.fence`，输出固定结构：`chat-md-code-block`、`chat-md-code-toolbar-slot`、`data-chat-code-action="copy|download"`、`data-chat-code-lang` 等；高亮逻辑与默认 `highlight` 回调一致。
- **样式与交互**：包内**不**包含工具栏视觉与点击逻辑；宿主（如本仓库 `ChatAssistantMessage` + `index.css` + `chatCodeToolbar`）负责布局与事件。

### 2.5 Mermaid 图表（可选）

- **开关**：`enableMermaid` 默认 `true`；`false` 时 ` ```mermaid ` 按普通代码块处理。
- **解析**：`patchMermaidFence()` 输出占位 DOM；**运行时**由 **`@dnhyxc-ai/tools/react`** 的 **`useMermaidInMarkdownRoot`**（或 **`runMermaidInMarkdownRoot`**）调用 Mermaid API 生成 SVG。
- **细节**：与聊天围栏的链式 `fence`、打包 external、宿主 `ref`/`trigger` 约定等见 **§11**。**助手消息流式**正文见 **§11.9**（围栏拆分 + 岛，非整段 `useMermaidInMarkdownRoot`）。

### 2.6 样式产物（`build-mk-css.js`）

1. **基础复制**：`github-markdown.css`、`katex.min.css` → `dist/styles/`；默认 **`github-dark.min.css`** 仍复制到 `dist/styles/` 根目录（兼容旧子路径）。
2. **全量主题**：递归扫描 `node_modules/highlight.js/styles` 下所有 **`*.min.css`** → `dist/styles/hljs/`（含 `base16/` 等），用于 `import '@dnhyxc-ai/tools/styles/hljs/...'`。
3. **KaTeX 字体**：`katex/dist/fonts` → `dist/styles/fonts/`，保证 `katex.min.css` 内相对 `url(fonts/...)` 可解析。
4. **`markdown-base.css`**：`github-markdown` + `katex` + 脚本内嵌的 **KaTeX 间距补丁**（**不含** highlight.js）。
5. **`markdown-styles.css`**：上述基础 + **github-dark** + 间距补丁（历史默认「一键全量」）。
6. **元数据**：根据磁盘上的 hljs 文件生成 `highlightJsThemes`（id → `./styles/hljs/...`）、`highlightJsThemeIds` 数组；写入 `dist/styles.js`、`dist/styles.d.ts`、`src/styles.ts`。
7. **`HighlightJsThemeId` 类型**：根据排序后的 `themeIds` 生成 `src/generated/highlight-js-theme-ids.ts` 中的 **`export type HighlightJsThemeId = | "..." | ...`**，供 TS 补全与 `MarkdownParserOptions.highlightTheme` 使用。

### 2.7 运行时主题注入（`inject-highlight-theme.ts`）

- **入口**：`applyHighlightJsTheme({ themeId?, themeCss?, onError? })`。
- **全局单例 DOM**：固定 `id="dnhyxc-ai-tools-hljs-theme"`，每次应用前 `remove()` 旧节点，保证全页**只有一条**由本包管理的主题样式。
- **分支逻辑**：
  - `themeCss !== undefined`：若为非空字符串，写 `<style id="...">`；若为空字符串，仅删除节点后 `return`（用于「卸主题」）。
  - 否则若 `themeId`：校验 `themeId in highlightJsThemes`，拼 **jsDelivr** URL：  
    `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@${HLJS_CDN_VERSION}/build/styles/${themeId}.min.css`  
    （`HLJS_CDN_VERSION` 需与 `package.json` 的 `highlight.js` 大版本一致，当前 **`11.11.1`**）。
- **SSR**：无 `document` 时直接 return。
- **`MarkdownParser` 构造**：若 `injectHighlightTheme !== false`，将 `highlightTheme` / `highlightThemeCss` / `onError` 转给 `applyHighlightJsTheme`。

### 2.8 包说明符解析（`highlight-theme-import.ts`）

- **实现**：`highlightJsThemes[themeId]` 取相对路径，去掉 leading `./`，前缀 `@dnhyxc-ai/tools/`，得到例如 `@dnhyxc-ai/tools/styles/hljs/atom-one-dark.min.css`。
- **类型**：参数为 `HighlightJsThemeId`，非法 id 在运行期抛错。

### 2.9 刻意不自动做的事

- **不在任何 TS 模块里静态 `import '*.css'`**，避免打包器副作用顺序不可控；正文/公式/代码配色均由应用 **`import` 子路径** 或 **构造参数注入** 显式引入。

---

## 3. `package.json` exports（消费方式）

| 条件导出                                | 含义                                               |
| --------------------------------------- | -------------------------------------------------- |
| `.`                                     | 主入口：`MarkdownParser`、主题 API、样式元数据等。 |
| `./styles`                              | `dist/styles.js` + 类型。                          |
| `./styles/*`、`./styles/*.css`          | `dist/styles/` 下根级 CSS。                        |
| `./styles/hljs/*`                       | 各 highlight 主题文件。                            |
| `./styles.css`、`./markdown-styles.css` | 合并默认（含 github-dark）。                       |
| `./markdown-base.css`                   | 无 hljs 的基础包。                                 |
| `./react`                               | **`useMermaidInMarkdownRoot` / `runMermaidInMarkdownRoot`** 与 Mermaid 运行时集成（见 §11）；依赖 **peer `react`**。 |

`sideEffects: true` 提示存在 CSS 副作用；tree-shaking 时勿误删未使用的「仅样式」导入。

---

## 4. 对外 API 速查

### 4.1 `MarkdownParser` / `MarkdownParserOptions`

- `render(text: string): string`
- `highlightTheme?: HighlightJsThemeId` — CDN 注入（需联网）。
- `highlightThemeCss?: string` — 内联注入；`''` 仅清除本包注入节点。
- `injectHighlightTheme?: boolean` — 默认 `true`；`false` 则完全不注入。
- `enableChatCodeFenceToolbar?: boolean`
- `enableMermaid?: boolean` — 默认 `true`；`false` 时 mermaid 围栏按普通代码块。配合 **`@dnhyxc-ai/tools/react`** 的 **`useMermaidInMarkdownRoot`**（见 §11）。
- 其余：`html`、`linkify`、`typographer`、`breaks`、`containerClass`、`onError`

### 4.2 主题与样式元数据

- `HighlightJsThemeId`（类型）
- `highlightJsThemes`、`highlightJsThemeIds`、`defaultHighlightJsThemeId`
- `styles`、`styleUrls`、`styleContents`（仅三份基础 CSS 字符串 + 默认 hljs，**不含**全部主题内联）
- `applyHighlightJsTheme`、`clearAppliedHighlightJsTheme`
- `resolveHighlightJsThemeSpecifier(themeId)`

---

## 5. 用法（推荐组合）

### 5.1 仅打包器 import（无 CDN）

- **全套默认**：`import '@dnhyxc-ai/tools/styles.css'`。
- **自选 hljs**：`import '@dnhyxc-ai/tools/markdown-base.css'` + `import '@dnhyxc-ai/tools/styles/hljs/<id>.min.css'`（后导入可覆盖先导入的 hljs 规则）。若宿主已有等价全局样式，可省略 `markdown-base`，见 §8。
- **构造器**：建议 `injectHighlightTheme: false`，避免与手动 CSS 重复。

### 5.2 构造参数注入 CDN（适合少配置页面）

- **推荐搭配**：再 `import '@dnhyxc-ai/tools/markdown-base.css'`，得到与工具包一致的 **GitHub Markdown 正文 + KaTeX 公式 + 间距**，代码配色由 `highlightTheme` 的 CDN 注入补齐。
- **也可以不引 `markdown-base.css`**：只要应用里已有其它全局样式能覆盖 `.markdown-body`、列表、引用、`.katex`、代码块容器等（例如本仓库 `apps/frontend/src/index.css` 对聊天区的规则），页面仍会「看起来正常」。此时你**没有**用到 `github-markdown-css` / `katex.min.css` 的完整规则集，复杂排版或公式可能出现与官方预览不一致、字体回退等问题。
- 典型写法：  
  `new MarkdownParser({ highlightTheme: 'github-dark' })`
- **注意**：若已 `import '@dnhyxc-ai/tools/styles.css'`（已含 github-dark），再传 `highlightTheme` 会**多加载**一套 hljs；应二选一或关闭注入。

### 5.3 离线 / Tauri / `?raw`

- `import css from '@dnhyxc-ai/tools/styles/hljs/night-owl.min.css?raw'`（路径以打包器为准）
- `new MarkdownParser({ highlightThemeCss: css })`

### 5.4 类型安全的主题常量（本仓库实践）

- 自 `@dnhyxc-ai/tools` 引入 `HighlightJsThemeId`，例如：  
  `export const CHAT_MARKDOWN_HIGHLIGHT_THEME: HighlightJsThemeId = 'base16/unikitty-dark';`
- `ChatAssistantMessage` / `ChatUserMessage` / `session-list` / `editor` / `document` 等处 `new MarkdownParser({ highlightTheme: CHAT_MARKDOWN_HIGHLIGHT_THEME, ... })`，修改主题 id 时 IDE 会提示全部合法字面量。

### 5.5 最小示例

```tsx
import { useMemo } from "react";
import { MarkdownParser } from "@dnhyxc-ai/tools";
import "@dnhyxc-ai/tools/styles.css";

export function Preview({ md }: { md: string }) {
	const parser = useMemo(
		() => new MarkdownParser({ injectHighlightTheme: false }),
		[],
	);
	return <div dangerouslySetInnerHTML={{ __html: parser.render(md) }} />;
}
```

```tsx
import { MarkdownParser } from "@dnhyxc-ai/tools";
// 可选：无此行时依赖应用全局 CSS 是否已覆盖 .markdown-body / .katex 等
import "@dnhyxc-ai/tools/markdown-base.css";

const parser = new MarkdownParser({ highlightTheme: "atom-one-dark" });
```

---

## 6. 开发与构建流程

### 6.1 命令

| 命令                                           | 作用                                                                                                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter @dnhyxc-ai/tools run clean`     | 删除 `dist/`、`src/styles.ts`（**不删** `src/generated/highlight-js-theme-ids.ts`，由下次 `build:css` 覆盖）。 |
| `pnpm --filter @dnhyxc-ai/tools run build:css` | 跑 `scripts/build-mk-css.js`。                                                                                 |
| `pnpm --filter @dnhyxc-ai/tools run build`     | `clean` → `build:css` → `tsup`。                                                                               |
| `prepack`                                      | 等价于 `pnpm build`，发包前保证产物完整。                                                                      |

### 6.2 修改代码后何时要 build

- 改了 **`markdown-parser.ts`**、**`inject-highlight-theme.ts`**、**`highlight-theme-import.ts`**、**`index.ts`**：至少 **`pnpm build`**（或仅 `tsup` 若 styles 未变）。
- 改了 **`build-mk-css.js`** 或升级 **`highlight.js`**：必须 **`build:css`**（会刷新 `hljs` 文件与 **`highlight-js-theme-ids.ts`**），再 **`tsup`**。
- **`src/generated/highlight-js-theme-ids.ts`**：应**提交仓库**，这样他人未先 build tools 也能获得正确类型；升级 hljs 后记得重新生成并提交。

### 6.3 tsup 说明

- **主入口** `src/index.ts` → `dist/index.{js,cjs}`，**ESM + CJS** + **dts**。
- **React 子入口** `src/react/index.ts` → `dist/react/index.{js,cjs}` + **dts**；**external**：`react`、`react/jsx-runtime`、`mermaid`（Mermaid 细节见 **§11.4**）。
- **`noExternal`（仅主入口）**：`highlight.js`、`markdown-it`、`markdown-it-katex`、`katex` 打进包内；**`markdown-it-task-lists` 不在此列**，列在 **`@dnhyxc-ai/tools` 的 `dependencies`** 中，由包管理器随本包安装；打包产物中保留 `import … from 'markdown-it-task-lists'`（不打进单文件 bundle）。

### 6.4 Monorepo / CI

- 依赖写法：`"@dnhyxc-ai/tools": "workspace:*"`。
- CI 在构建前端前执行：  
  `pnpm --filter @dnhyxc-ai/tools run build`  
  以免 `dist` 缺失或过旧。

### 6.5 对外发布 npm（可选）

- bump `packages/tools` 的 `version`，`pnpm build`，再 `pnpm publish`（需 scope 权限）。

---

## 7. 本仓库引用现状（摘要）

| 区域                              | 方式                                                                                                                                                  |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatAssistantMessage`            | **`StreamingMarkdownBody`**（`enableMermaid: false` 的 `MarkdownParser` + **`runMermaidInMarkdownRoot`** 独立岛）+ `highlightTheme`；**不**再对整条助手消息使用 **`useMermaidInMarkdownRoot`**（见 **§11.9**）。 |
| `ChatUserMessage`、`session-list` | `highlightTheme`；若渲染含 Mermaid 的 Markdown 且存在流式整段 innerHTML，可复用 **§11.9** 模式或 **`useMermaidInMarkdownRoot`**（无流式时）。                                                                 |
| `editor`、`document`              | `import styles.css` + `highlightTheme` + **`useMermaidInMarkdownRoot`**（见 §11）                                                                                                                         |
| 主题常量                          | `apps/frontend/src/constant/index.ts` 中 `CHAT_MARKDOWN_HIGHLIGHT_THEME: HighlightJsThemeId`                                                          |

聊天区若未全局引入 tools 的合并 CSS，仍可能依赖 **`apps/frontend/src/index.css`** 内对 `.markdown-body`、`.chat-md-code-block` 等的定制；与「完整 GitHub Markdown + KaTeX + hljs」并存时，以实际 import 为准。

---

## 8. 常见问题

**不 `import markdown-base.css` 也能用、样式也像生效？**  
可以。`markdown-base.css` 只是把 **github-markdown-css + katex + 间距补丁**打成一份方便引用的包；**不是**解析器运行所必需。若项目里已有 **`styles.css` / `styles` 子路径其它文件**、或像本仓库 **`index.css` 里对 `#message-md-wrap .markdown-body`、`.chat-md-code-block` 等**的定制，再加上 **`highlightTheme` CDN 注入的 hljs**，视觉上往往已经够用。缺 `markdown-base` 时，差异主要在：**是否具备完整的 GitHub 风正文规则**、**KaTeX 专用字体与细节**是否与官方一致；无全局补全时，才更容易出现「只有结构、没有精致排版」或公式回退字体。

**未 `import styles.css` 为何仍有部分样式？**  
`MarkdownParser` 仍会输出带 class 的 DOM；宿主全局 CSS（如本仓库 `index.css`）与浏览器默认样式会让列表、代码块容器等「看起来有样式」。完整的 **hljs 配色**与 **KaTeX 字体**仍依赖对应 CSS 或 CDN/内联注入。

**CDN 注入失败？**  
检查网络、防火墙；离线场景改用 `highlightThemeCss` 或打包器 `import '*.css'`。

**多个 `MarkdownParser` 实例、不同主题？**  
注入节点全局唯一，后创建的实例会替换前一个主题；同一页多主题需 Shadow DOM 等额外方案，本包未内置。

---

## 9. `README.md`

`packages/tools/README.md` 中部分片段已过时，**以本文档与 `src/` 源码为准**。

---

## 10. GFM 待办列表（Task lists）— 影响面、风险与实现说明

本节对应 **`packages/tools` 中为 Markdown 增加 GitHub 风格待办勾选框** 的改动：依赖 `markdown-it-task-lists`，并增加一层 core 规则以兼容「行内仅有 `[x]` / `[X]` / `[ ]`、无后续正文」的常见写法。

### 10.1 改动概要

| 类别           | 内容                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **依赖**       | `package.json` 增加 **`markdown-it-task-lists`**（运行时依赖，见 §6.3）。                                                            |
| **类型**       | `src/types.d.ts` 增加 **`declare module 'markdown-it-task-lists'`**，便于 TypeScript 识别默认导出插件函数。                          |
| **解析逻辑**   | `src/markdown-parser.ts`：`md.use(markdownItTaskLists, { enabled: false })` + 私有方法 **`patchGfmTaskListBareMarkers()`** + 模块级辅助函数。 |
| **对外 API**   | **无新增构造参数**；`render()` 签名与选项对象与改动前一致。                                                                          |
| **样式**       | 仍依赖宿主引入的 **`github-markdown-css`**（如 `styles.css` / `markdown-base.css`）中的 `.contains-task-list`、`.task-list-item-checkbox` 等；本包未新增独立 CSS 文件。 |

### 10.2 影响点（谁会感知到）

1. **所有调用 `MarkdownParser.render()` 的场景**（聊天消息、知识库预览、分享页、文档编辑预览等）：凡原文中出现 GFM 待办语法，**输出 HTML 会从「纯文本列表」变为「带 disabled checkbox 的结构」**，视觉与 GitHub 预览更一致。
2. **DOM / 安全策略**：输出中出现 **`<input type="checkbox" disabled>`**（`html: true` 本就允许富 HTML；此处为固定模板字符串，不拼接用户原文到标签属性）。若业务曾对 `dangerouslySetInnerHTML` 做 **严格 DOMPurify 白名单** 且未允许 `input`，可能被剥离勾选框——需自行放宽白名单或保持现状（列表仍可读，只是无框）。
3. **可访问性 / 交互**：`enabled: false` 与 **`disabled`** 表示**展示用**待办，与 GitHub 静态渲染一致；**不会**在页面上产生可点击改状态的待办（避免与「只读预览」模型冲突，并减小误触与 XSS 面）。
4. **打包体积 / 依赖树**：多一个较小依赖；`tsup` 未将其打入 `noExternal`，安装 `@dnhyxc-ai/tools` 时会一并安装 `markdown-it-task-lists`。

### 10.3 是否破坏原有功能逻辑？

**总体结论：预期不破坏既有非待办 Markdown 行为；待办相关为增量能力。仍须注意下列边界：**

| 场景 | 说明 |
| ---- | ---- |
| **普通列表** | 无 `[ ]` / `[x]` 语法的列表，token 流与以前一致，**不受影响**。 |
| **标准 GFM 待办** | `- [ ] 文案`、`- [x] 文案` 等由 **`markdown-it-task-lists`** 处理，与社区常用行为一致。 |
| **仅勾选框、无正文** | 如 `2. [x]`、`- [ ]`：插件无法识别（解析后 inline 仅为 `[x]`/`[ ]`），由 **`patchGfmTaskListBareMarkers`** 补勾选框；**属新增能力**，不改变非匹配列表项。 |
| **`[x]文字`（`]` 后无空格）** | Markdown 中 `[x]` 易被识别为**链接引用**前缀，**无法**可靠当作待办；与 GitHub 一致写法应为 **`[x] 文字`**（`]` 与正文之间有空格）。这不是回归，而是语法限制。 |
| **KaTeX / 代码块 / 围栏工具栏** | 插件注册顺序为：KaTeX → task-lists → **bare 补丁** → `addLatexDelimiters` → 可选 fence 覆盖；待办规则在 **core** 阶段、与块级数学规则正交，**不修改** fence 与高亮回调。 |
| **性能** | 每次 `render` 多一次 core 扫描（O(token 数)），量级与 markdown-it 自身相比可忽略。 |

若未来升级 **`markdown-it`** 或 **`markdown-it-task-lists`** 大版本，需回归：**待办 HTML 结构**、**`github-task-lists` ruler 名称是否仍为 `github-task-lists`**（`patchGfmTaskListBareMarkers` 使用 `md.core.ruler.after('github-task-lists', …)`，名称若变需同步修改）。

### 10.4 代码说明（逐段）

#### 10.4.1 模块级辅助函数（`taskListAttrSet` / `taskListParentTokenIndex`）

- **`taskListAttrSet(token, name, value)`**：对 markdown-it 的 **`Token`** 写入或覆盖 `class` 等属性（内部用 `attrIndex` / `attrPush`），与 `markdown-it-task-lists` 源码中的 `attrSet` 同理，避免重复造轮子时行为不一致。
- **`taskListParentTokenIndex(tokens, index)`**：从某一 `list_item_open` 向前找 **低一级 `level`** 的 token，用于定位外层 **`ul_open` / `ol_open`**，以便打上 **`contains-task-list`**，与官方 GFM 结构一致。

#### 10.4.2 `md.use(markdownItTaskLists, { enabled: false })`

- **作用**：在 token 流上把符合插件条件的列表项改为带 **`html_inline`** 勾选框 + 调整 `class`。
- **`enabled: false`**：勾选框带 **`disabled`**，静态展示；与本文档 §10.2 中「只读预览」策略一致。

#### 10.4.3 `patchGfmTaskListBareMarkers()`

- **挂载点**：`md.core.ruler.after('github-task-lists', 'gfm-task-list-bare', callback)`，保证在官方插件跑完之后再修正「漏网」项。
- **匹配条件**（需同时满足）：
  - 当前 token 为 **`inline`**；
  - 前一个是 **`paragraph_open`**；
  - 再前一个是 **`list_item_open`**；
  - **`inline.content`** 精确等于 **`[x]`**、**`[X]`** 或 **`[ ]`**（整段列表项正文只有勾选标记、无其它字符）。
- **动作**：
  1. 用 **`state.Token`** 构造 **`html_inline`**，内容为带 `task-list-item-checkbox`、`disabled`、`type="checkbox"` 的 `<input>`，已勾选项加 **`checked=""`**。
  2. 将该 token **插入** `inline.children` 首部，并把原 **第一个 `text` 子节点** 的 `content` 置空，同步清空 **`inline.content`**，避免重复输出文本。
  3. 给对应 **`list_item_open`** 设置 **`class="task-list-item"`**，给父级 **`ul`/`ol`** 设置 **`class="contains-task-list"`**（与插件输出对齐）。
- **刻意不处理**：`inline.content` 为 **`[x]foo`** 等紧贴正文（无空格）的情况，避免与链接引用等 inline 规则冲突；用户应使用 **`[x] foo`**。

#### 10.4.4 `src/types.d.ts`

- 为 **`markdown-it-task-lists`** 声明 **`export =`** 风格的默认导出及可选 **`TaskListsOptions`**，避免 `TS7016`（无声明文件）。

---

## 11. Mermaid 图表渲染（完整思路、依赖与逐行说明）

本节描述：**Markdown 中 ` ```mermaid ` 围栏** 如何变成 **可执行占位 DOM**，以及 **React 宿主在何时、如何调用 Mermaid API** 完成 SVG 渲染。实现拆在 **`MarkdownParser`（主包）** 与 **`@dnhyxc-ai/tools/react`（子路径）** 两处。**常规页面**可 **`useMermaidInMarkdownRoot`** + 单次/低频 **`dangerouslySetInnerHTML`**。**流式聊天**若对**整条正文**高频整段替换 innerHTML，会反复冲掉 Mermaid 已生成的 SVG，仅靠 hook 节流/防抖难以根治，本仓库采用 **§11.9 围栏拆分 + Mermaid 岛** 方案。

### 11.1 整体设计（数据流）

1. **解析阶段（同步）**：`MarkdownParser.render(md)` 走 `markdown-it`，对语言名为 **`mermaid`** 的 fence token **不走** 普通 `<pre><code>` 高亮路径，而是输出一段 **固定结构的 HTML 字符串**（外层可检索、内层类名符合 Mermaid 约定）。
2. **挂载阶段（React）**：宿主用 **`dangerouslySetInnerHTML`**（或其它方式）把上一步 HTML 放进 DOM；此时浏览器里只有 **纯文本节点**（图 DSL）包在 **`<div class="mermaid">`** 内，**尚未**生成 SVG。
3. **渲染阶段（异步）**：Mermaid 官方推荐在 DOM 就绪后调用 **`mermaid.run({ nodes })`**。本包在 **`useLayoutEffect`** 里用 **连续两次 `requestAnimationFrame`**，尽量等到布局与常见滚动容器（如 Radix ScrollArea）子树稳定后再执行，减少「节点尺寸为 0」类问题。
4. **并发控制**：全局 **`runQueue`**（`Promise` 链）串行化多次 `run`，避免多处预览同时触发 **`mermaid.run`** 导致内部状态错乱。

### 11.2 与 `MarkdownParser` 的契约

| 项目 | 说明 |
| ---- | ---- |
| **构造选项** | `enableMermaid?: boolean`，默认 **`true`**；设为 **`false`** 时 **不**注册 `patchMermaidFence`，` ```mermaid ` 按普通代码块高亮展示。 |
| **实例字段** | `readonly enableMermaid`，与构造选项一致，供 hook 判断是否执行渲染。 |
| **注册时机** | 构造函数中在 GFM 待办、LaTeX 定界符、可选聊天围栏等之后调用 **`patchMermaidFence()`**（仅当 `enableMermaid` 为真）。 |
| **输出 HTML** | 每条 mermaid 围栏对应：`<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid">…转义后的 DSL…</div></div>`；**DSL 经 `escapeHtml`**，避免注入 HTML，由 Mermaid 再解析文本。 |
| **外层容器** | `render()` 仍包裹 **`<div class="${containerClass}">`**（默认 **`markdown-body`**），与 github-markdown-css 一致。 |

### 11.3 与「聊天围栏工具栏」的共存关系

构造函数中的顺序为：**若** `enableChatCodeFenceToolbar` **则先** `patchChatCodeFenceRenderer()`（完全覆盖 `md.renderer.rules.fence`），**再若** `enableMermaid` **则** `patchMermaidFence()`。

`patchMermaidFence` 的实现是：**保存当前的 `fence` 规则为 `prev`**，再赋新函数：若 `lang === 'mermaid'` 则返回 Mermaid 占位 HTML；**否则**调用 **`prev(...)`**。

因此：

- **仅 Mermaid**：`prev` 为 markdown-it 默认 fence（或链上其它插件），非 mermaid 语言行为不变。
- **聊天工具栏 + Mermaid**：`prev` 为聊天专用 fence；mermaid 语言 **仍** 走占位分支，**不会** 进聊天代码块外壳（避免把图 DSL 当成高亮代码块）。

### 11.4 打包与依赖（`mermaid` 为何是 external）

- **`tsup` 第二入口** `src/react/index.ts` → `dist/react/index.js`：将 **`react` / `react/jsx-runtime` / `mermaid`** 列为 **external**，**不**把 `mermaid` 打进 `dist/react/index.js`。
- **原因**：曾尝试把 `mermaid` **bundle 进** react 产物时，会卷入 Node 的 **`crypto`**（如 `randomFillSync`），Vite 等浏览器打包器会将 `crypto` 映射为 **`__vite-browser-external`**，导致 **生产构建失败**。
- **依赖声明**：`mermaid` 放在 **`@dnhyxc-ai/tools` 的 `dependencies`** 中，由包管理器安装到可解析路径；宿主应用构建时通常能从 **`node_modules`** 解析到 **`mermaid`**（monorepo 下已通过 `pnpm` 验证）。若极端工具链解析失败，可在应用层 **显式增加** `mermaid` 依赖（仅声明，无需写渲染逻辑）。
- **Vite 建议**：在宿主 `optimizeDeps.include` 中可包含 **`@dnhyxc-ai/tools/react`** 与 **`mermaid`**，以改善开发态预构建。

### 11.5 宿主集成要点（`useMermaidInMarkdownRoot`）

| 参数 | 作用 |
| ---- | ---- |
| **`rootRef`** | 必须指向 **已写入 `parser.render()` 产出 HTML** 的 DOM 节点（常为 **`dangerouslySetInnerHTML` 所在的那层 `div`**）。`querySelector` 从该节点向下查找占位块；若 ref 挂在外层而 HTML 在内层，可能 **选不到** `.markdown-mermaid-wrap`。 |
| **`parser`** | 传入 **`MarkdownParser` 实例**（或至少含 **`enableMermaid`** 的对象）；为 **`false`** 时 hook **直接 return**，不调 Mermaid。 |
| **`trigger`** | 任意在「HTML 字符串更新」时会变的值（如 **`html` 字符串、`content`、版本号**），列入 `useLayoutEffect` 依赖，保证替换 innerHTML 后会 **重新跑** 一轮渲染。 |
| **`preferDark`** | 传入 **`mermaid.initialize({ theme: 'dark' | 'default' })`**；随主题切换更新。 |
| **`throttleMs`**（可选） | 在 **仍使用** **`useMermaidInMarkdownRoot` + 单容器 innerHTML** 的前提下，用 **200～400ms** **节流**缓解 rAF 饿死与「防抖反复清定时器」；**聊天助手正文流式**已改 **§11.9**，**不再**依赖本项。已废弃别名 **`debounceMs`**（语义同 **`throttleMs`**）。 |

非 React 环境可 **`import { runMermaidInMarkdownRoot } from '@dnhyxc-ai/tools/react'`**，在合适时机自行调用（仍需已挂载占位 DOM）。

### 11.6 样式（宿主）

Mermaid 输出以 **SVG** 为主。本仓库前端在 **`apps/frontend/src/index.css`** 等对 **`.markdown-body .markdown-mermaid-wrap`**、**`svg`** 做了间距与最大宽度约束，避免撑破聊天/预览布局；**包内 CSS 不含** Mermaid 专用样式，由宿主按需补充。

### 11.7 故障排查

- **控制台**出现 **`[mermaid-in-markdown]`**：默认 **`suppressErrors: false`** 时语法错误等会反映到 **`catch` + `console.warn`**；**`runMermaidInMarkdownRoot(..., { suppressErrors: true })`**（如 **§11.9** 流式岛）则抑制 **`mermaid.run`** 内错误展示。
- **有占位无图**：检查 **`rootRef`** 是否对准 **innerHTML 容器**；在 DevTools 中确认是否存在 **`.markdown-mermaid-wrap[data-mermaid="1"] .mermaid`**。**流式 + 整段 innerHTML**：若出现「停流才出图」或整屏闪烁，优先采用 **§11.9 围栏拆分**；**`throttleMs`** 仅缓解 **`useMermaidInMarkdownRoot`** 的调度，**不能**阻止 innerHTML 替换掉已渲染的 SVG。非流式仍可调 **`throttleMs`** 或确认 **`trigger` 是否在变**。
- **构建失败且与 `crypto` 相关**：勿将 **`mermaid` 再 bundle 进** 工具包 react 入口；保持 **external**。

### 11.8 源码逐行说明

以下与仓库 **`packages/tools/src/`** 中当前实现 **一一对应**（行号随文件演进可能漂移，以源码为准）。

#### 11.8.1 `src/mermaid-in-markdown.ts`

| 行号 | 代码 | 说明 |
| ---- | ---- | ---- |
| 1 | `import mermaid from 'mermaid'` | 引入 Mermaid 运行时（由应用打包器从 `node_modules` 解析，见 §11.4）。 |
| 3–4 | `let runQueue = Promise.resolve()` | **模块级串行队列**：多次调用 `runMermaidInMarkdownRoot` 时通过 `.then` 链排队，避免并行 `mermaid.run`。 |
| 20–25 | `export type RunMermaidInMarkdownOptions` | **`preferDark`**、可选 **`suppressErrors`**（显式 **`true`** 时传入 **`mermaid.run`**，流式岛等场景用）。 |
| 27–30 | JSDoc | 说明函数职责及与 `@dnhyxc-ai/tools/react`、**external `mermaid`** 的关系（详见 §11.4）。 |
| 31–34 | `export async function runMermaidInMarkdownRoot(...)` | 异步入口函数声明与参数。 |
| 35 | `if (!root) return` | 无 DOM 根则跳过。 |
| 37 | `const task = async () => { ... }` | 真正工作放在 **串行队列** 的异步函数内。 |
| （模块级） | `ensureMermaidInitialized` / `lastMermaidInitSignature` | **仅在主题签名变化时**调用 **`mermaid.initialize`**，避免每次 `run` 重置内部状态导致闪烁。 |
| 38–42 | `root.querySelectorAll('.markdown-mermaid-wrap…')` | 在 **`root` 整棵子树**上收集占位节点（多 **`.markdown-body`**、**Mermaid 岛宿主** 均适用）。 |
| 42 | `if (nodes.length === 0) return` | 无占位则不调 Mermaid，减少开销。 |
| 44–49 | `ensureMermaidInitialized` + `mermaid.run` | **`suppressErrors: options?.suppressErrors === true`**：仅显式传 **`true`** 时抑制错误（流式岛场景）；默认 **`false`**。 |
| 50–54 | `catch` / `runQueue` | 错误日志与串行队列语义不变。 |

#### 11.8.2 `src/react/use-mermaid-in-markdown-root.ts`

| 片段 | 说明 |
| ---- | ---- |
| **`UseMermaidInMarkdownRootParams`** | 含可选 **`throttleMs`**（及已废弃别名 **`debounceMs`**）。 |
| **`generationRef`** | 双 rAF 内若代数已变则 **return**；**不在 cleanup 里 `cancelAnimationFrame`**。 |
| **`throttleMs > 0`** | **节流**：`lastInvoke` + **挂起中的 `setTimeout` 不在每次 effect 清理**（仅卸载或 `throttleMs` 改 0 / 关闭 Mermaid 时清理）；到点 **`invoke`** 读最新 **`rootRef`**。节流期间 **`runMermaidInMarkdownRoot`** 传 **`suppressErrors: true`** 减轻不完整 DSL 闪烁。 |
| **`throttleMs === 0`** | 清除挂起 timeout 后 **`runAfterLayout()`**；**`suppressErrors: false`**。 |
| **依赖数组** | 含 **`throttleMs`**。 |

#### 11.8.3 `src/react/index.ts`

| 行号 | 代码 | 说明 |
| ---- | ---- | ---- |
| 1–2 | `RunMermaidInMarkdownOptions` / `runMermaidInMarkdownRoot` | 供非 React 或自定义调度使用。 |
| 3–7 | 类型再导出 | 供 TypeScript 用户引用 **`UseMermaidInMarkdownRootParams`** 等。 |
| 7 | `useMermaidInMarkdownRoot` | React 集成主入口。 |

#### 11.8.4 `src/markdown-parser.ts`（Mermaid 相关片段）

| 行号（约） | 代码 | 说明 |
| ---------- | ---- | ---- |
| 121–125 | `MarkdownParserOptions` 内 `enableMermaid?` 与 JSDoc | 对外文档化：与 **`useMermaidInMarkdownRoot`** 配合。 |
| 129–130 | `readonly enableMermaid` | 实例只读字段，供 hook 读取。 |
| 136 | `this.enableMermaid = options.enableMermaid !== false` | **默认开启**；仅 **`=== false`** 时关闭。 |
| 191–193 | `this.patchMermaidFence()` | 始终注册 fence 包装；是否生效由 `render(env)` 控制（见下节）。 |
| 294–297 | `patchMermaidFence`：保存 `prev` | **链式装饰**：保留原 `fence` 行为给非 mermaid 语言。 |
| 298–303 | 新 `fence`：读取 `env.enableMermaid ?? this.enableMermaid` | **渲染期可控**：同一实例可按“本次渲染”开关 Mermaid，占位 DOM 输出与否不再只能在构造时决定。 |
| 304–309 | 解析 `token.info` 得 `langName` | 与 highlight、聊天 fence 一致：取 info 第一段为语言名。 |
| 310–317 | `langName.toLowerCase() === 'mermaid'` 分支 | **DSL** 使用 **`escapeHtml(token.content)`** 再写入 innerHTML 安全文本节点路径（浏览器解析后内容为纯文本，Mermaid 读取文本）。 |
| 307–310 | 外层 **`markdown-mermaid-wrap`** + **`data-mermaid="1"`** | 与 **`runMermaidInMarkdownRoot`** 的 **选择器** 一致；内层 **`class="mermaid"`** 为 Mermaid 约定入口。 |
| 313 | `return prev(...)` | 非 mermaid 走原规则（默认高亮或聊天块等）。 |

#### 11.8.5 本轮补充：`render(text, { enableMermaid })`（避免重复 new parser）

**动机**：

- 宿主（如 Monaco 预览）经常需要同时满足两类渲染：
  - **整段预览**：允许把 ```mermaid 输出为占位 DOM，随后由 `useMermaidInMarkdownRoot` 扫描并渲染 SVG；
  - **Mermaid 岛布局**：Markdown 文本段需要 **禁用 Mermaid 占位**（否则会与“拆分成岛”的 Mermaid 渲染重复）。
- 旧做法只能通过 **构造参数**决定 `enableMermaid`，因此宿主往往被迫 **new 两个 `MarkdownParser`**（一个开、一个关），成本与维护复杂度都更高。

**方案**：

- 保留实例级默认（构造参数 `enableMermaid`），同时让 `render()` 接收可选覆盖项：
  - `render(text)`：完全兼容旧调用；
  - `render(text, { enableMermaid: false })`：仅本次渲染禁用 Mermaid 占位 DOM。

关键代码（与仓库一致）：

```ts
// packages/tools/src/markdown-parser.ts
export type MarkdownRenderOptions = {
	/** 本次渲染是否启用 Mermaid 占位 DOM 输出（未提供则回退实例默认） */
	enableMermaid?: boolean;
};

public render(text: string, renderOptions: MarkdownRenderOptions = {}): string {
	const env: MarkdownRenderEnv = {
		enableMermaid: renderOptions.enableMermaid ?? this.enableMermaid,
	};
	return `<div class="${this.containerClass}">${this.md.render(text, env)}</div>`;
}
```

**兼容性边界**：

- **不会影响**所有旧调用点：`parser.render(text)` 仍然按实例默认工作；
- Mermaid fence 的“是否生效”变为 **渲染期判断**：只有当 `env.enableMermaid === true` 时才输出 `.markdown-mermaid-wrap`；否则回退到 `prev`（普通代码块路径）。

---

#### 11.8.6 本轮补充：代码块复制/下载动作下沉（`markdown-code-fence-actions.ts`）

**动机**：

- `MarkdownParser` 在 `enableChatCodeFenceToolbar: true` 时会为围栏代码块输出工具栏 DOM（复制/下载按钮），但若每个业务方都手写：
  - `closest('[data-chat-code-block]')`
  - `querySelector('pre code')`
  - `navigator.clipboard.writeText(...)`
  - “已复制”按钮文案切换 + 定时恢复
  会造成重复实现与行为不一致。

**方案**：将“解析点击目标 → 提取代码块文本/语言/文件名 → 分发动作”的逻辑做成工具层 API。

工具侧核心导出（见 `packages/tools/src/markdown-code-fence-actions.ts`）：

- `bindMarkdownCodeFenceActions(root, options)`：绑定点击事件并分发 `copy/download`
  - **默认 copy**：`enableDefaultCopy !== false` 时调用 `navigator.clipboard.writeText(code)`
  - **默认 copy 反馈**：`copyFeedback !== false` 时按钮显示 `已复制` 并在短暂延迟后恢复
- `getMarkdownCodeFenceInfo(block)`：从 DOM 提取 `{ code, lang, filename, ... }`
- `downloadMarkdownCodeFenceWith(info, download)`：把 `code` 转为 `Blob` 并交给宿主的下载器执行（Web/Tauri/Electron 统一入口）
- `createMarkdownCodeFenceInfo({ code, lang, filename })`：不依赖 DOM 构造下载信息（适用于 Mermaid 代码模式等“只有文本”的场景）

##### 11.8.6.1 事件解析：从点击目标定位到“当前代码块”

代码块工具栏的按钮由 `MarkdownParser` 输出，带有稳定的 `data-*` 约定：

- `data-chat-code-action="copy|download"`：表示点击意图
- 代码块根：`[data-chat-code-block]`

工具侧通过 `closest(...)` 自底向上定位按钮与代码块，再统一提取代码文本/语言/文件名：

```ts
// packages/tools/src/markdown-code-fence-actions.ts（核心逻辑摘录）
export function resolveMarkdownCodeFenceActionPayload(target, root, options) {
	// 1) 找按钮：允许点在 <span>/<svg> 等子节点上，统一向上找最近的 action 按钮
	const button = el?.closest('[data-chat-code-action]');
	// 2) action：只放行 copy/download，其它字符串直接忽略
	const action = button.getAttribute('data-chat-code-action');
	// 3) 找代码块容器：保证 copy/download 操作总是作用于“就近代码块”
	const block = button.closest('[data-chat-code-block]');
	// 4) 安全边界：按钮/代码块必须属于 root（避免跨容器串扰）
	if (!root.contains(button) || !root.contains(block)) return null;
	// 5) 结构化 payload：把业务方最关心的信息一次性准备好
	return { action, button, root, ...getMarkdownCodeFenceInfo(block, options) };
}
```

##### 11.8.6.2 信息提取：`getMarkdownCodeFenceInfo(block)` 负责统一“取文本/语言/文件名”

业务侧最容易写散的地方是“从 DOM 里取代码文本 / 语言名”。工具侧统一约定：

- 代码文本：`pre code` 的 `textContent`
- 语言名：`.chat-md-code-lang` 的文本（由解析器输出）
- 扩展名：语言到扩展名的映射（未知语言做安全回退）
- 文件名：默认 `code.<ext>`，也允许宿主通过 `getFilename(...)` 自定义

```ts
// packages/tools/src/markdown-code-fence-actions.ts（核心逻辑摘录）
export function getMarkdownCodeFenceInfo(block, { getFilename } = {}) {
	const code = getMarkdownCodeFencePlainText(block);
	const lang =
		block.querySelector('.chat-md-code-lang')?.textContent?.trim()?.toLowerCase() ||
		'text';
	const fileExtension = markdownCodeFenceFileExtension(lang);
	const baseInfo = { block, code, lang, fileExtension };
	return {
		...baseInfo,
		filename: getFilename?.(baseInfo) ?? `code.${fileExtension}`,
	};
}
```

##### 11.8.6.3 默认复制与复制反馈：让业务方不必每处都写 “已复制” 定时恢复

`bindMarkdownCodeFenceActions` 的 **copy 默认行为**：

- 未传 `onCopy` 时，走工具内置 `navigator.clipboard.writeText(code)`
- copy 成功后默认调用 `showMarkdownCodeFenceCopiedFeedback(button)`：
  - 写 `data-chat-code-copied="1"`
  - 按钮文案切换为 `已复制`
  - 约 1.5s 后恢复原文案

```ts
// packages/tools/src/markdown-code-fence-actions.ts（核心逻辑摘录）
if (payload.action === 'copy') {
	if (options.onCopy) {
		await options.onCopy(payload);
	} else if (options.enableDefaultCopy !== false) {
		await copyMarkdownCodeFence(payload); // navigator.clipboard.writeText(payload.code)
		if (options.copyFeedback !== false) {
			showMarkdownCodeFenceCopiedFeedback(payload.button);
		}
	}
}
```

##### 11.8.6.4 下载：`downloadMarkdownCodeFenceWith(info, download)` 让“落盘”交给宿主

下载在不同平台差异很大（Web / Tauri / Electron），所以工具包不强行决定怎么写文件，而是把“下载任务”结构化后交给宿主：

```ts
// packages/tools/src/markdown-code-fence-actions.ts（核心逻辑摘录）
export async function downloadMarkdownCodeFenceWith(info, download) {
	const blob = new Blob([info.code], { type: 'text/plain;charset=utf-8' });
	await download({
		code: info.code,
		lang: info.lang,
		fileExtension: info.fileExtension,
		filename: info.filename,
		blob,
	});
}
```

仓库内落地示例（前端侧统一走 `downloadBlob`）：

```ts
// apps/frontend/src/utils/chatCodeToolbar.ts（逻辑摘录）
const info = getMarkdownCodeFenceInfo(block, {
	getFilename(base) {
		return `code_${Date.now()}.${base.fileExtension}`;
	},
});
await downloadMarkdownCodeFenceWith(info, (task) =>
	downloadBlob({ file_name: task.filename, id: Date.now().toString(), overwrite: true }, task.blob)
);
```

##### 11.8.6.5 非标准代码块场景：`createMarkdownCodeFenceInfo`（Mermaid 代码模式）

有些下载不来自“标准 code block DOM”（例如 Mermaid 顶栏的代码模式下载 `.mmd`），此时用 `createMarkdownCodeFenceInfo` 直接从文本构造下载信息：

```ts
// apps/frontend/src/components/design/MermaidFenceToolbar/index.tsx（逻辑摘录）
const info = createMarkdownCodeFenceInfo({
	code: mermaidCode,
	lang: 'mermaid',
	filename: `mermaid-${Date.now()}.mmd`,
});
await downloadMarkdownCodeFenceWith(info, (task) =>
	downloadBlob({ file_name: task.filename, id: `mermaid-md-${Date.now()}`, overwrite: true }, task.blob)
);
```

**关于作用域（非常重要）**：

- 推荐使用 `bindMarkdownCodeFenceActions(root, options)` 显式传入根容器，把事件作用域限制在当前渲染区域。
- 也支持 `bindMarkdownCodeFenceActions(options)` 省略 root（默认绑定到 `document`），但当页面存在多个实例（如聊天列表 + Monaco 预览同时挂载）时可能出现“不同实例抢同一个按钮点击”的串扰。

仓库落地点（`apps/frontend`）：

- `ChatCodeToolBar/index.tsx`：复制走 `copyMarkdownCodeFence(getMarkdownCodeFenceInfo(block))`；下载走业务侧落盘函数，但内容/文件名由工具层统一提供。
- `MermaidFenceToolbar/index.tsx`：图表模式下载 SVG 仍走现有 SVG 导出；代码模式下载 `.mmd` 则用 `createMarkdownCodeFenceInfo` + `downloadMarkdownCodeFenceWith` 统一落盘路径。

### 11.9 流式聊天场景（本仓库前端）：围栏拆分与 Mermaid 岛

本节记录 **助手消息流式输出** 时 Mermaid **无法稳定显示**、**全文闪烁** 的成因与落地实现。代码位于 **`apps/frontend/`**（非 `packages/tools`），但与 **`MarkdownParser`、`runMermaidInMarkdownRoot`** 紧密配合，故写入本文档便于对照。

#### 11.9.1 根因（为何节流/防抖不够）

1. **整段 `dangerouslySetInnerHTML`**：每来一段 token，React 用**新 HTML 字符串整体替换**容器子树，此前由 **`mermaid.run`** 写入的 **SVG 与内部 DOM 修改** 一并被销毁。
2. **与 `useMermaidInMarkdownRoot` 叠加**：即使 **`throttleMs`** 节流调度，**下一次 innerHTML 仍会在节流间隔后到来**，图仍会被冲掉；**防抖 + effect cleanup 清定时器** 还会在 chunk 极密时导致 **长时间不触发 `mermaid.run`**（表现为「停流才出图」）。
3. **结论**：流式下若坚持 **单容器整段 render**，Mermaid 与 React 的 DOM 所有权冲突难以从 hook 层彻底消除，需 **缩小 innerHTML 的替换范围** 或 **把 Mermaid 挂到不受该次替换影响的节点上**。

#### 11.9.2 方案概要（围栏拆分 + 独立岛）

| 步骤 | 做法 |
| ---- | ---- |
| 1 | 对原始 Markdown 字符串做 **线性扫描**，按顶格 **\`\`\`** 围栏切成多段：**普通文本**、**已闭合 mermaid**、**未闭合 mermaid**（流式尾部）。 |
| 2 | **普通段**：仍用 **`MarkdownParser.render`** + **`dangerouslySetInnerHTML`**；解析器设 **`enableMermaid: false`**，避免围栏内 mermaid 再被转成占位（与手工拆块重复）。 |
| 3 | **未闭合 mermaid**：**不**调用 Mermaid，只输出带 **`language-mermaid`** 的 **`<pre><code>`** 预览（转义 HTML），避免不完整 DSL 报错与无意义重绘。 |
| 4 | **已闭合 mermaid**：每个块对应一个 React 子树 **`MermaidIsland`**：外层 **`div`** 由 React 持有 **`ref`**，在 **`useLayoutEffect`** 内 **命令式** 写入 **`markdown-mermaid-wrap > .mermaid`**，再调用 **`runMermaidInMarkdownRoot(host, { preferDark, suppressErrors })`**（由 **`@dnhyxc-ai/tools/react`** 导出）。 |
| 5 | **流式追加**通常只改变 **最后一个 Markdown 段** 或 **开放中的 mermaid 预览段**；**更早的已闭合 Mermaid 岛** **`code` prop 不变** 时 **不**重跑 effect，**SVG 不被后续 chunk 的 innerHTML 清掉**。 |

#### 11.9.3 与 `@dnhyxc-ai/tools` 的分工

| 组件 | 职责 |
| ---- | ---- |
| **`MarkdownParser`（`enableMermaid: false`）** | 渲染非 mermaid 围栏的 Markdown（含聊天代码块工具栏等）。 |
| **`runMermaidInMarkdownRoot`** | 在 **岛宿主节点** 子树内查找 **`.markdown-mermaid-wrap[data-mermaid="1"] .mermaid`** 并 **`mermaid.run`**；与包内 **`patchMermaidFence`** 产出的 **class / data 属性** 一致。 |
| **`useMermaidInMarkdownRoot`** | **本场景不再用于** `ChatAssistantMessage` 整条气泡；仍适用于 **Monaco / 文档** 等 **非「整段正文流式 innerHTML」** 的页面。 |

#### 11.9.4 文件与入口

| 路径 | 角色 |
| ---- | ---- |
| **`apps/frontend/src/utils/splitMarkdownFences.ts`** | **`splitMarkdownByCodeFences`**、**`mermaidStreamingFallbackHtml`**、类型 **`MarkdownFencePart`**。 |
| **`apps/frontend/src/components/design/ChatAssistantMessage/StreamingMarkdownBody.tsx`** | **`StreamingMarkdownBody`**、内部 **`MermaidIsland`**。 |
| **`apps/frontend/src/components/design/ChatAssistantMessage/index.tsx`** | 构造 **`chatMdParser`（`enableMermaid: false`）**，正文与思考区挂载 **`StreamingMarkdownBody`**，**`bodyMarkdownRef`** 传给 **`containerRef`** 以兼容 Serper 角标等逻辑。 |

#### 11.9.5 `splitMarkdownFences.ts` 逐行说明

| 行号 | 代码 / 构造 | 说明 |
| ---- | ----------- | ---- |
| 1–4 | 文件头注释 | 说明用途：**按围栏拆分**，供聊天流式 **Mermaid 岛** 使用，避免整段 innerHTML 冲掉 SVG。 |
| 6–8 | `MarkdownFencePart` | 联合类型：**`markdown`** 段原始文本；**`mermaid`** 段 DSL 文本 + **`complete`**（是否已出现闭合 **\`\`\`**）。 |
| 10–23 | `coalesceMarkdownParts` | 合并**相邻**的 **`markdown`** 片段，减少 React 子节点数量与 innerHTML 块数；跳过空 **`markdown`** 文本。 |
| 12–13 | `if (p.type === 'markdown' && p.text === '') continue` | 不向结果集推入空 markdown，避免多余空 div。 |
| 14–16 | `last?.type === 'markdown'` | 与前一段同为 markdown 则 **拼接 `text`**，否则 **push** 新元素。 |
| 18–20 | `out.push(...)` | markdown 浅拷贝文本；mermaid 用展开拷贝，保留 **`complete`**。 |
| 26–28 | `splitMarkdownByCodeFences` 注释 | 约定：扫描 **\`\`\`lang**；mermaid **未闭合** 时 **`complete: false`**。 |
| 29–32 | `out` / `i` / `n` | 输出数组、扫描指针、源长度。 |
| 34–40 | `while` 内 `indexOf('```', i)` | 找下一围栏起点；**无**则把 **`i` 起至末尾** 作为 markdown 并 **break**。 |
| 41–43 | `fenceStart > i` | 围栏前有普通正文则先入栈一段 **markdown**。 |
| 44–48 | `langEnd` | 取 **\`\`\` 后第一行换行** 作为语言行结束；**无换行** 则整段从 **\`\`\`** 起视为无法解析的 markdown，**break**。 |
| 49–53 | `lang` | 语言名 **trim + toLowerCase**，与解析器惯例一致。 |
| 53–54 | `bodyStart` | 围栏正文从 **换行后** 开始。 |
| 54–65 | `closeIdx` | 查找闭合 **\`\`\`**；**不存在** 时：若 **`lang === 'mermaid'`** 则 **开放 mermaid** 段，否则把从 **\`\`\`** 起的剩余都当作 **markdown**（避免半段其它语言误拆）。 |
| 67–75 | 闭合分支 | 取出 **body**；**mermaid** → **`complete: true`**；否则整段围栏（含标记）作为 **markdown** 交给 **`MarkdownParser`**。 |
| 76 | `i = closeIdx + 3` | 跳过闭合围栏，继续向后扫描。 |
| 79–81 | 空结果兜底 | 源非空却未产生片段时，整源作为 **markdown**（如无任何围栏）。 |
| 82 | `return coalesceMarkdownParts` | 返回合并后的片段列表。 |
| 85–91 | `escapeHtml` | 将 **& < > "** 转为实体，供未跑 Mermaid 时的 **纯文本** 安全插入 HTML。 |
| 93–97 | `mermaidStreamingFallbackHtml` | **未闭合** mermaid 的占位：**`markdown-body`** 包裹 **`<pre class="chat-md-mermaid-streaming">`**，内层 **`code.language-mermaid`** 写入转义后的 **DSL**。 |

**局限**：仅识别 **顶格 \`\`\`**；**缩进围栏、~~~、围栏内嵌未转义 \`\`\`** 等边界与通用 Markdown 一致地可能误切，聊天场景通常可接受。

#### 11.9.6 `StreamingMarkdownBody.tsx` 逐行说明

| 行号 | 代码 / 构造 | 说明 |
| ---- | ----------- | ---- |
| 1–4 | 文件头注释 | **拆块渲染**：普通 md 用 innerHTML，mermaid 用 **岛 + `runMermaidInMarkdownRoot`**。 |
| 6–7 | `MarkdownParser` / `runMermaidInMarkdownRoot` | 类型来自 **`@dnhyxc-ai/tools`**，运行时 API 来自 **`@dnhyxc-ai/tools/react`**。 |
| 9–14 | React 导入 | **`memo`/`useLayoutEffect`/`useMemo`/`useRef`/`RefObject`**。 |
| 15 | `cn` | 合并 **容器** class。 |
| 16–19 | `splitMarkdownFences` 工具导入 | 拆分与 fallback HTML。 |
| 21–25 | `MermaidIslandProps` | **`code`**：闭合围栏内 DSL；**`preferDark`**：主题；**`isStreaming`**：是否仍处流式（经 ref 参与 **`suppressErrors`**）。 |
| 27 | `memo(MermaidIsland)` | 避免父级无关重渲染时无谓刷新（**`code`/`preferDark` 不变** 则跳过）。 |
| 32–33 | `hostRef` / `genRef` | 岛 **DOM 宿主**；**代数** 丢弃过期的双 **rAF** 回调。 |
| 34–36 | `isStreamingRef` | **每轮 render 同步** **`isStreaming`**；**不**放入 **`useLayoutEffect` 依赖**，避免 **停流** 时仅为改 **`suppressErrors`** 再 **整岛 innerHTML** 闪屏。 |
| 38–45 | `useLayoutEffect` 主体（DOM） | 取 **host**；写入与 **`patchMermaidFence`** 一致的 **wrap + .mermaid** 结构；**`textContent = code`** 避免 React 子节点与 Mermaid 改 DOM 冲突。 |
| 47–56 | 双 **rAF** + **`runMermaidInMarkdownRoot`** | 与 hook 策略一致，等布局后再跑；**`suppressErrors: isStreamingRef.current`**：流式过程中为 **true** 时压制不完整图的错误 UI（由 **`mermaid-in-markdown`** 传给 **`mermaid.run`**）。 |
| 57 | 依赖 **`[code, preferDark]`** | **仅** DSL 或主题变时重建岛内部并重跑 Mermaid。 |
| 59 | `return <div ref={hostRef} ...>` | React 只稳定持有 **外层宿主**，内层由 effect 管理。 |
| 62–68 | `StreamingMarkdownBodyProps` | **`markdown`** 全文；**`parser`**（应 **`enableMermaid: false`**）；**`containerRef`** 供父级 **Serper 角标** 等挂 ref。 |
| 79–82 | `useMemo(split...)` | **`markdown` 变** 才重新拆分，避免每 render 重复扫描。 |
| 85 | 根 **`div`** | **`containerRef`** + **`streaming-md-body`** + 传入 **className**。 |
| 86–113 | `parts.map` | 按片段类型分支渲染。 |
| 87–93 | **`markdown`** | **`key={md-${i}}`**；**`parser.render(part.text)`** 写 **innerHTML**（多段 **`.markdown-body`** 并列，样式仍由宿主 CSS 命中）。 |
| 95–103 | **`mermaid` 且 `!complete`** | **`key={mm-open-${i}}`**；**`mermaidStreamingFallbackHtml`** 注入 **代码预览**。 |
| 105–112 | **`mermaid` 且 `complete`** | **`MermaidIsland`**，**`key={mm-done-${i}}`**；**`isStreaming`** 传入供 ref 读取。 |

#### 11.9.7 `ChatAssistantMessage/index.tsx` 接入片段（逐行）

| 行号（约） | 代码 | 说明 |
| ---------- | ---- | ---- |
| 35 | `import { StreamingMarkdownBody } from './StreamingMarkdownBody'` | 引入拆块正文组件。 |
| 143–151 | `chatMdParser` **`useMemo`** | **`enableMermaid: false`**：**mermaid 围栏** 由拆分器抽出，**不得**再让解析器生成 **`markdown-mermaid-wrap`**，否则重复。 |
| 154–162 | `bodyText` **`useMemo`** | 与原先一致：正文 + **Serper 角标** 替换等。 |
| （移除） | 原 **`useMermaidInMarkdownRoot`** | 整条气泡 **不再**用 hook 扫 **shellRef**，避免与 **多段 innerHTML** 逻辑重复且无法解决 **整段替换** 问题。 |
| 思考区 JSX | **`<StreamingMarkdownBody markdown={message.thinkContent} ... />`** | 思考内容若含 mermaid，与正文同一套拆块策略；**`isStreaming={!!message.isStreaming}`**。 |
| 正文 JSX | **`<StreamingMarkdownBody containerRef={bodyMarkdownRef} markdown={bodyText} ... />`** | **角标** 等依赖 **`bodyMarkdownRef`** 的监听仍挂在 **外层容器** 上。 |

#### 11.9.8 复制该模式时的检查清单

- 解析器 **`enableMermaid: false`** 与 **手工拆分** 二选一配套，勿双重输出 mermaid 占位。
- **岛的 `host`** 传给 **`runMermaidInMarkdownRoot`** 的节点应 **包含** **`.markdown-mermaid-wrap`** 子树（与工具包选择器一致）。
- **开放围栏** 仅用 **fallback**，待 **闭合 \`\`\`** 出现后片段变为 **`complete: true`**，React **key** 从 **`mm-open-*`** 变为 **`mm-done-*`**，会 **卸载预览、挂载岛**，属预期一次切换。
- 若需 **严格** 在停流后暴露 Mermaid 语法错误，可在 **`isStreaming` 变为 false** 后增加 **仅针对岛的补跑**（当前实现依赖 **`code` 不变** 则不再跑 effect；一般最终图已在流式过程中画出，**`suppressErrors`** 仅影响报错展示）。

---

_文档与 `packages/tools` 及本仓库 `apps/frontend` 当前实现对齐；升级 `highlight.js` 后请同步更新 `inject-highlight-theme.ts` 内 `HLJS_CDN_VERSION` 并重新执行 `build:css`。_
