# `@dnhyxc-ai/tools` 包说明（功能、实现与用法）

`packages/tools` 发布为 **`@dnhyxc-ai/tools`**，供本 monorepo 内前端 / universal 使用。核心交付物是：**Markdown → HTML 解析器（`MarkdownParser`）**、**可打包的 Markdown/KaTeX/highlight.js 样式与字体**、以及 **highlight.js 主题的「类型安全 id + 多路径消费（import / CDN / 内联）」**。

---

## 1. 源码与产物结构

| 路径                                      | 角色                                                                                                                    |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `src/markdown-parser.ts`                  | `MarkdownIt` + `markdown-it-katex` + `highlight.js` 高亮；可选围栏工具栏；构造末尾调用主题注入。                        |
| `src/inject-highlight-theme.ts`           | `applyHighlightJsTheme` / `clearAppliedHighlightJsTheme`：向 `document.head` 注入 `<link>`（CDN）或 `<style>`（内联）。 |
| `src/highlight-theme-import.ts`           | `resolveHighlightJsThemeSpecifier`：把主题 id 转成 `@dnhyxc-ai/tools/styles/hljs/...` 包内说明符。                      |
| `src/generated/highlight-js-theme-ids.ts` | **构建生成**：`HighlightJsThemeId` 字面量联合，与 `dist/styles/hljs` 下文件一一对应。                                   |
| `src/styles.ts`                           | **构建生成**：`highlightJsThemes`、`highlightJsThemeIds`、`styleContents`、`styles` 等（`pnpm clean` 会删，勿手改）。   |
| `src/index.ts`                            | 包入口：聚合导出类型与函数。                                                                                            |
| `scripts/build-mk-css.js`                 | 复制 CSS/字体、写合并文件、写 `dist/styles.js` / `styles.d.ts` / `src/styles.ts`、写 `highlight-js-theme-ids.ts`。      |
| `tsup.config.ts`                          | 打 `dist/index.{js,cjs}` + `d.ts`；`noExternal` 打入 markdown-it / katex / highlight.js。                               |
| `dist/styles/**`                          | 运行时样式产物（`dist/` 默认不提交，由 CI/本地 `pnpm build` 生成）。                                                    |

---

## 2. 功能清单与实现方式

### 2.1 Markdown 渲染与容器

- **实现**：`MarkdownIt` 实例，默认 `html/linkify/typographer/breaks` 与项目需求对齐。
- **输出**：`render(text)` 内先对 `\text{○}` 做替换以规避 KaTeX 度量问题，再 `md.render`，外层包 `<div class="${containerClass}">`（默认 `markdown-body`），便于配合 `github-markdown-css`。
- **错误**：`try/catch` 中调用可选 `onError`，失败时仍包容器并回退为转义前的原文占位。

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

### 2.5 样式产物（`build-mk-css.js`）

1. **基础复制**：`github-markdown.css`、`katex.min.css` → `dist/styles/`；默认 **`github-dark.min.css`** 仍复制到 `dist/styles/` 根目录（兼容旧子路径）。
2. **全量主题**：递归扫描 `node_modules/highlight.js/styles` 下所有 **`*.min.css`** → `dist/styles/hljs/`（含 `base16/` 等），用于 `import '@dnhyxc-ai/tools/styles/hljs/...'`。
3. **KaTeX 字体**：`katex/dist/fonts` → `dist/styles/fonts/`，保证 `katex.min.css` 内相对 `url(fonts/...)` 可解析。
4. **`markdown-base.css`**：`github-markdown` + `katex` + 脚本内嵌的 **KaTeX 间距补丁**（**不含** highlight.js）。
5. **`markdown-styles.css`**：上述基础 + **github-dark** + 间距补丁（历史默认「一键全量」）。
6. **元数据**：根据磁盘上的 hljs 文件生成 `highlightJsThemes`（id → `./styles/hljs/...`）、`highlightJsThemeIds` 数组；写入 `dist/styles.js`、`dist/styles.d.ts`、`src/styles.ts`。
7. **`HighlightJsThemeId` 类型**：根据排序后的 `themeIds` 生成 `src/generated/highlight-js-theme-ids.ts` 中的 **`export type HighlightJsThemeId = | "..." | ...`**，供 TS 补全与 `MarkdownParserOptions.highlightTheme` 使用。

### 2.6 运行时主题注入（`inject-highlight-theme.ts`）

- **入口**：`applyHighlightJsTheme({ themeId?, themeCss?, onError? })`。
- **全局单例 DOM**：固定 `id="dnhyxc-ai-tools-hljs-theme"`，每次应用前 `remove()` 旧节点，保证全页**只有一条**由本包管理的主题样式。
- **分支逻辑**：
  - `themeCss !== undefined`：若为非空字符串，写 `<style id="...">`；若为空字符串，仅删除节点后 `return`（用于「卸主题」）。
  - 否则若 `themeId`：校验 `themeId in highlightJsThemes`，拼 **jsDelivr** URL：  
    `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@${HLJS_CDN_VERSION}/build/styles/${themeId}.min.css`  
    （`HLJS_CDN_VERSION` 需与 `package.json` 的 `highlight.js` 大版本一致，当前 **`11.11.1`**）。
- **SSR**：无 `document` 时直接 return。
- **`MarkdownParser` 构造**：若 `injectHighlightTheme !== false`，将 `highlightTheme` / `highlightThemeCss` / `onError` 转给 `applyHighlightJsTheme`。

### 2.7 包说明符解析（`highlight-theme-import.ts`）

- **实现**：`highlightJsThemes[themeId]` 取相对路径，去掉 leading `./`，前缀 `@dnhyxc-ai/tools/`，得到例如 `@dnhyxc-ai/tools/styles/hljs/atom-one-dark.min.css`。
- **类型**：参数为 `HighlightJsThemeId`，非法 id 在运行期抛错。

### 2.8 刻意不自动做的事

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

`sideEffects: true` 提示存在 CSS 副作用；tree-shaking 时勿误删未使用的「仅样式」导入。

---

## 4. 对外 API 速查

### 4.1 `MarkdownParser` / `MarkdownParserOptions`

- `render(text: string): string`
- `highlightTheme?: HighlightJsThemeId` — CDN 注入（需联网）。
- `highlightThemeCss?: string` — 内联注入；`''` 仅清除本包注入节点。
- `injectHighlightTheme?: boolean` — 默认 `true`；`false` 则完全不注入。
- `enableChatCodeFenceToolbar?: boolean`
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

- **单入口** `src/index.ts`，**ESM + CJS** + **dts**。
- **`noExternal`**：`highlight.js`、`markdown-it`、`markdown-it-katex`、`katex` 打进包内，应用侧只需依赖 `@dnhyxc-ai/tools` 即可使用解析逻辑；样式仍走 exports 子路径或 CDN/内联注入。

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
| `ChatAssistantMessage`            | `enableChatCodeFenceToolbar: true` + `highlightTheme: CHAT_MARKDOWN_HIGHLIGHT_THEME`                                                                  |
| `ChatUserMessage`、`session-list` | `highlightTheme: CHAT_MARKDOWN_HIGHLIGHT_THEME`                                                                                                       |
| `editor`、`document`              | `import styles.css` + `highlightTheme`（若需避免重复 hljs，可评估改为 `markdown-base` + `highlightTheme` 或对解析器设 `injectHighlightTheme: false`） |
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

_文档与 `packages/tools` 当前实现对齐；升级 `highlight.js` 后请同步更新 `inject-highlight-theme.ts` 内 `HLJS_CDN_VERSION` 并重新执行 `build:css`。_
