### 1. 目标与范围

- **目标**：为 `@dnhyxc-ai/tools` 提供一套“Markdown → HTML”的解析与增强能力，覆盖常见文档预览、聊天消息渲染、Monaco 分屏预览等场景，并将关键 DOM/事件契约固化为可复用的工具函数与常量。
- **范围**：
  - Markdown 渲染：`MarkdownParser`（基于 `markdown-it`）
  - 数学公式：KaTeX（KaTeX，数学排版）
  - 代码高亮：highlight.js（highlight.js，代码高亮）
  - GFM 待办列表：task lists（任务列表）
  - 聊天围栏代码块工具栏：复制/下载（DOM 契约 + 事件绑定）
  - Mermaid（Mermaid，图表 DSL）围栏占位 + 浏览器渲染（含 React hook）
  - 样式/主题：默认样式文件导出、highlight.js 多主题映射、CDN/内联注入与清理
- **非目标**：
  - 不负责宿主应用的样式细节（仅导出推荐的 CSS 与 DOM 契约常量）
  - 不在本包内实现“下载文件保存到磁盘”的具体 UI（只构造 `Blob` 并交给宿主下载器）
  - 不承诺对任意 raw HTML 的安全渲染（默认禁用 raw HTML；开启后需宿主 sanitize（清洗））

---

### 2. 目录结构与关键入口

- **入口文件**：`packages/tools/src/index.ts`
- **关键依赖**：
  - **markdown**：
    - `packages/tools/src/markdown/parser.ts`：`MarkdownParser` 核心实现
    - `packages/tools/src/markdown/code-fence-dom.ts`：围栏代码块（fence）带工具栏的 DOM 契约常量与选择器
    - `packages/tools/src/markdown/code-fence-actions.ts`：围栏代码块复制/下载动作解析与默认行为
  - **mermaid**：
    - `packages/tools/src/mermaid/markdown-selectors.ts`：Mermaid 占位 DOM 契约与选择器
    - `packages/tools/src/mermaid/in-markdown.ts`：`runMermaidInMarkdownRoot`（队列化 + initialize 去抖）
    - `packages/tools/src/react/use-mermaid-in-markdown-root.ts`：`useMermaidInMarkdownRoot`（双 rAF + 节流）
  - **highlight**：
    - `packages/tools/src/highlight/inject-theme.ts`：主题注入/清理（全局单例节点）
    - `packages/tools/src/highlight/theme-import.ts`：主题 id → 可 import 的包说明符
    - `packages/tools/src/highlight/styles.ts`：构建生成的主题映射与样式导出
  - **generated**：
    - `packages/tools/src/generated/highlight-js-theme-ids.ts`：`HighlightJsThemeId` 类型（与 `styles.ts` 对齐）

---

### 3. 核心概念与术语

- **MarkdownParser**：基于 `markdown-it` 的渲染器实例，提供 `render()`（输出 HTML 字符串）与 `splitForMermaidIslands()`（按 Mermaid 围栏拆块）。
- **render env（渲染环境）**：`markdown-it` 的 `render(text, env)` 第二参数，本包用它承载 `headingSlugCounts`（锚点去重计数）与 `enableMermaid`（渲染期开关）。
- **containerClass（容器类名）**：渲染结果外层包裹 `<div class="...">` 的类名，默认 `markdown-body`，用于让 `github-markdown-css` 等样式生效。
- **fence（围栏代码块）**：Markdown 中的三反引号代码块。开启“聊天工具栏”后，fence 会输出带工具栏的固定 DOM 结构。
- **Mermaid placeholder（Mermaid 占位）**：当 ` ```mermaid ` 围栏被启用时，输出 `<div class="markdown-mermaid-wrap" data-mermaid="1"><div class="mermaid">...</div></div>`，再由 `mermaid.run` 渲染为 SVG。
- **主题注入节点（全局单例）**：highlight.js 主题通过 `<link>` 或 `<style>` 注入 `document.head`，以固定 id `dnhyxc-ai-tools-hljs-theme` 覆盖替换。

---

### 4. 用户可见功能点（按用户动作拆分）

#### 4.1 Markdown 渲染：`MarkdownParser.render(text, renderOptions?)`

- **触发入口**
  - 宿主调用 `new MarkdownParser(options)` 创建实例后，调用 `parser.render(text)` 获取 HTML 字符串并挂载（常见是 `innerHTML` / `dangerouslySetInnerHTML`）。
- **前置条件/互斥条件**
  - `text` 为空字符串时直接返回空字符串（不包裹容器）。
  - 若宿主允许 raw HTML（`html: true`），需自行对输出做 sanitize（清洗），否则存在 XSS（跨站脚本攻击）风险。
- **状态变化（state/ref/map）**
  - `render()` 内部构造一次性 `env`：
    - `env.headingSlugCounts`：标题 slug 的计数器，用于重复标题时生成 `id`：`xxx`、`xxx-1`、`xxx-2`…
    - `env.enableMermaid`：本次渲染是否启用 Mermaid 占位输出（优先级：`renderOptions.enableMermaid` > 实例 `enableMermaid`）
- **网络调用**
  - 无。
- **UI 表现**
  - 返回值总是外层包裹 `containerClass` 的 `<div>`，使 `github-markdown-css` 及相关样式生效。
- **错误处理与回滚**
  - `markdown-it` 渲染异常时：
    - 调用可选 `onError(error)`
    - 降级返回：`<div class="${containerClass}">${text}</div>`（原 Markdown 原文直接插入；不做 escape）
- **边界条件**
  - 渲染前会把 `\\text{○}` 替换为 `\\circ`，避免 KaTeX 字符度量告警导致渲染链路异常（属于“兼容性修复”而非通用 LaTeX 转换）。

#### 4.2 代码高亮（highlight.js）

- **触发入口**
  - Markdown 围栏语言名存在且 `hljs.getLanguage(lang)` 识别成功时，调用 `hljs.highlight()` 得到 HTML；否则走降级分支（让 `markdown-it` 自己输出代码文本）。
- **前置条件/互斥条件**
  - 仅当围栏语言可识别才高亮；不可识别则不抛错。
- **状态变化**
  - 无跨 render 的状态；但在构造 `MarkdownParser` 时可选择是否注入主题（见 §6.1）。
- **错误处理与回滚**
  - `hljs.highlight` 异常会被吞掉并回退为“不高亮”。

#### 4.3 GFM 待办列表（task lists）兼容补丁

- **触发入口**
  - Markdown 中出现 `[x]` / `[X]` / `[ ]` 且作为列表项段落的唯一文本时。
- **前置条件/互斥条件**
  - 仅处理“裸标记”（bare markers）：`[x]`、`[ ]` 等常见于行尾无正文的情况。
  - 要求 token 形态满足：`list_item_open` → `paragraph_open` → `inline`。
- **状态变化**
  - 在 `markdown-it` core 阶段对 token tree 做 patch：
    - 给列表项 token 写 `class="task-list-item"`
    - 给父列表 token 写 `class="contains-task-list"`
    - 给 inline children 注入一个 `html_inline` checkbox，并清空原文本节点
- **UI 表现**
  - 输出禁用态 checkbox（`disabled type="checkbox"`），避免交互导致的状态错觉与额外安全面。

#### 4.4 标题预览增强：行号与锚点 id

- **触发入口**
  - 构造 `MarkdownParser` 时：
    - `enableHeadingSourceLineAttr: true` 或
    - `enableHeadingAnchorIds !== false`（默认开启）
- **状态变化**
  - 覆盖 `markdown-it` 的 `heading_open` renderer：
    - 若 `token.map` 存在：写入 `data-md-heading-line`（1-based 行号）
    - 计算标题纯文本（剥离链接/图片/加粗/行内代码等装饰），slugify 后生成 `id`，并用 `env.headingSlugCounts` 去重
- **边界条件**
  - 标题文本为空时，用 `heading-${line1Based}` 作为兜底 id。
  - slugify 规则会删除非字母/数字/空白/`-_` 的字符，并将空白折叠为 `-`。

#### 4.5 Mermaid：围栏占位输出 + DOM 内渲染

- **触发入口**
  - 渲染期：`renderOptions.enableMermaid` 或实例 `enableMermaid` 为 true，且围栏语言为 `mermaid`。
  - DOM 渲染期：宿主在 HTML 挂载到 DOM 后调用：
    - React：`useMermaidInMarkdownRoot({ rootRef, preferDark, trigger, parser, throttleMs? })`
    - 非 React：`runMermaidInMarkdownRoot(root, { preferDark?, suppressErrors? })`
- **前置条件/互斥条件**
  - `mermaid.run` 只应在 DOM 已写入后执行；hook 内使用“双 rAF”保证布局后再跑。
  - 流式场景 DSL 不完整时，建议用节流模式并 `suppressErrors: true`，减少错误占位闪烁。
- **状态变化**
  - `MarkdownParser` 会对 Mermaid DSL 做 `normalizeMermaidFenceBody()`：
    - 统一换行（`\r\n`/`\r` → `\n`）
    - 对方括号 label 内包含 `/` 或 `+` 且未加引号的片段补双引号（跳过梯形 `[/.../]` 与 Mermaid 关键字 id）
  - `runMermaidInMarkdownRoot`：
    - 使用全局 `runQueue` 串行化多次 `mermaid.run`，避免并发打乱 Mermaid 内部状态
    - 使用 `lastMermaidInitSignature`，仅在 `preferDark` 切换时重新 `mermaid.initialize`
- **错误处理与回滚**
  - `mermaid.run` 异常会被捕获并 `console.warn('[mermaid-in-markdown]', err)`；不抛到宿主，避免中断渲染链路。

#### 4.6 聊天围栏代码块工具栏：复制 / 下载

- **触发入口**
  - 构造 `MarkdownParser({ enableChatCodeFenceToolbar: true })` 后渲染包含围栏代码块的 Markdown。
  - 宿主调用 `bindMarkdownCodeFenceActions(root?, options?)` 对点击事件做委托处理。
- **前置条件/互斥条件**
  - 点击目标必须匹配 `data-chat-code-action` 的按钮，并且按钮/代码块必须属于 `root` 子树。
- **状态变化**
  - 默认复制：调用 `navigator.clipboard.writeText(code)`
  - 复制反馈：按钮写入 `data-chat-code-copied="1"`，文案临时变更为“已复制”，超时恢复
  - 下载：本包只提供 `downloadMarkdownCodeFenceWith(info, download)` 将代码封装成 `Blob` 交给宿主下载器
- **UI 表现**
  - DOM 契约见 §6.2；语言显示优先取围栏语言，否则为 `text`。
- **错误处理与回滚**
  - 默认复制依赖浏览器剪贴板权限；失败将以 Promise rejection 形式出现（本包不吞错，便于宿主提示）。

---

### 5. 状态模型与数据结构

- **MarkdownRenderEnv**
  - `headingSlugCounts?: Record<string, number>`：用于 `id` 去重；以 slug base 为 key，累计次数。
  - `enableMermaid?: boolean`：渲染期开关（覆盖实例默认值）。
- **MarkdownMermaidSplitPart**
  - `type: 'markdown' | 'mermaid'`
  - `markdown` 段包含 `lineBase0`（0-based 段首行号，基于把全文 EOL 归一后的行数组），用于把“分段 render 的标题行号”还原到全文坐标系。
  - `mermaid` 段包含 `complete`（当前实现返回的 Mermaid 段为 `complete: true`，不在此函数里表达流式未闭合围栏；该能力在应用侧 `splitMarkdownByCodeFences` 等可扩展实现中体现）。
- **MarkdownCodeFenceInfo / ActionPayload**
  - `code`：从 `pre code` 的 `textContent` 读取（用于复制/下载的“原始代码文本”，不依赖高亮 HTML）
  - `lang`：从工具栏 `.chat-md-code-lang` 读取并归一为小写，缺省 `text`
  - `fileExtension`：由 `lang` 映射或回退（非法字符回退 `txt`）
  - `filename`：默认 `code.<ext>`，可由 `getFilename` 自定义

---

### 6. 协议与接口契约

#### 6.1 构造选项：`MarkdownParserOptions`（关键项）

- **`html`**：是否允许 raw HTML（默认 `false`）。开启会增加 XSS 风险，必须宿主 sanitize（清洗）。
- **`containerClass`**：外层容器类名（默认 `markdown-body`）。
- **`onError`**：渲染异常回调；同时用于主题注入失败等错误上报。
- **`codeBlockTabSize`**：围栏代码块 `\t` 展开空格数（默认 `2`；`0` 表示保留 Tab）。
- **`enableChatCodeFenceToolbar`**：围栏输出“语言/复制/下载”工具栏 DOM（默认 `false`）。
- **`highlightTheme`**：highlight.js 主题 id（类型 `HighlightJsThemeId`）。若注入开启，会走 jsDelivr CDN `<link>` 注入。
- **`highlightThemeCss`**：主题 CSS 全文；非空时用 `<style>` 内联注入并优先于 `highlightTheme`；传 `''` 表示仅移除已注入主题。
- **`injectHighlightTheme`**：是否执行主题注入（默认 `true`）。
- **`enableHeadingSourceLineAttr`**：标题写 `data-md-heading-line`（默认 `false`）。
- **`enableHeadingAnchorIds`**：标题写 `id`（默认 `true`）。
- **`enableMermaid`**：实例级 Mermaid 开关（默认 `true`；渲染期仍可覆盖）。

#### 6.2 DOM 契约：围栏代码块（enableChatCodeFenceToolbar）

当启用后，围栏代码块输出固定结构（关键契约点）：

- **根节点标记**：`[data-chat-code-block]`
- **外层 class**：`.chat-md-code-block`
- **工具栏**：`.chat-md-code-toolbar`
- **语言标签**：`.chat-md-code-lang`
- **按钮动作属性**：`data-chat-code-action="copy" | "download"`
- **源码节点**：`pre code`（复制/下载从其 `textContent` 读取）

宿主事件绑定建议使用事件委托，并通过 `resolveMarkdownCodeFenceActionPayload()` 解析出：
`{ action, button, block, code, lang, fileExtension, filename, root }`。

#### 6.3 DOM 契约：Mermaid 占位

当 Mermaid 启用且围栏语言为 `mermaid` 时输出：

- **外层**：`div.markdown-mermaid-wrap[data-mermaid="1"]`
- **入口**：外层内的 `div.mermaid`（其文本内容为转义后的 DSL）

`runMermaidInMarkdownRoot` 会在 root 子树内收集上述入口节点并执行 `mermaid.run({ nodes, suppressErrors })`。

---

### 7. 互斥与状态机（关键规则）

- **Mermaid 渲染互斥（并发控制）**
  - 多处调用 `runMermaidInMarkdownRoot` 时，内部通过 `runQueue` 串行化，避免 Mermaid 内部状态被并发 run 打乱。
- **Mermaid initialize 抖动控制**
  - 仅当 `preferDark` 发生变化时重新 `mermaid.initialize`，避免每次 run 都 initialize 造成主题与内部状态抖动。
- **流式渲染节流（React hook）**
  - `useMermaidInMarkdownRoot` 使用“节流（throttle，节流）”而非“防抖（debounce，防抖）”：
    - 持续有 chunk 时仍按固定间隔执行 `mermaid.run`
    - 避免防抖导致“停流才出图”
  - 节流模式下默认 `suppressErrors: true`，减少不完整 DSL 的错误闪烁。

---

### 8. 性能与工程约束

- **避免重复创建解析器**
  - `MarkdownParser` 内含多项 patch 与依赖初始化（KaTeX、task list、renderer 覆盖等），建议宿主用 `useMemo` 或单例复用。
- **Mermaid 渲染的时序保障**
  - hook 使用双 `requestAnimationFrame`，避免在 `dangerouslySetInnerHTML` 写入前/中跑扫描导致漏渲染或读到旧 DOM。
- **代码块缩进稳定性**
  - `codeBlockTabSize` 默认展开 Tab 为 2 空格，使“显示/复制/下载”一致，降低跨环境 Tab 宽度差异造成的对齐问题。
- **样式副作用**
  - 包对外提供 CSS 文件导出，且存在样式副作用；不要期望仅靠 tree-shaking 获得完整排版。

---

### 9. 错误提示与 Toast 规范

- **主题注入错误**
  - `applyHighlightJsTheme({ themeId })` 若 themeId 不存在，会通过 `onError(new Error(...))` 上报。
  - CDN `<link>` 加载失败会触发 `link.onerror` 并上报建议：检查网络或改用 `highlightThemeCss`。
- **Mermaid 渲染错误**
  - `runMermaidInMarkdownRoot` 捕获错误并 `console.warn`，默认不打断 UI。
  - 宿主如需用户提示，应在调用层增加监控/上报，而非依赖本包抛错。
- **复制失败**
  - 默认复制依赖剪贴板权限；建议宿主在 `onCopy` 自定义实现中捕获并提示用户（例如 Toast）。

---

### 10. 验收清单（可直接用于测试）

- **Markdown 基础渲染**
  - [ ] `render('')` 返回 `''`（不包含容器 div）
  - [ ] `render('# 标题')` 返回外层带 `markdown-body` 的 HTML
  - [ ] raw HTML 默认转义输出（`html: false`），不会在 HTML 中出现未转义的 `<script>`
- **XSS 安全**
  - [ ] `html: true` 时 raw HTML 会被原样输出（宿主必须 sanitize（清洗））
- **KaTeX**
  - [ ] `$a+b$` 能渲染；`\(...\)` 与 `\[...\]` 分隔符生效
  - [ ] 公式错误不会抛异常中断渲染（`throwOnError: false`）
  - [ ] 文本中 `\\text{○}` 会被替换为 `\\circ`
- **代码高亮与缩进**
  - [ ] 围栏语言可识别时高亮生效；不可识别时不崩溃并回退
  - [ ] `codeBlockTabSize=2` 时 Tab 被替换为 2 空格，复制/下载与显示一致
- **待办列表**
  - [ ] 列表项仅包含 `[x]` / `[ ]` 时仍能输出禁用态 checkbox，并带 `task-list-item` / `contains-task-list`
- **标题锚点与行号**
  - [ ] 开启 `enableHeadingSourceLineAttr` 后，标题含 `data-md-heading-line` 且为 1-based
  - [ ] 重复标题的 `id` 会自动去重：`xxx`、`xxx-1`、`xxx-2`
  - [ ] 标题文本为空时 id 形如 `heading-<line>`
- **Mermaid**
  - [ ] `enableMermaid: true` 且出现 ` ```mermaid ` 时输出占位 DOM（含 `data-mermaid="1"` 与 `.mermaid`）
  - [ ] DOM 挂载后调用 `runMermaidInMarkdownRoot` 能渲染出 SVG
  - [ ] `preferDark` 切换时 Mermaid 主题随之变化（initialize 仅在切换时触发）
  - [ ] Mermaid DSL 内方括号 label 含 `/` 或 `+` 且未加引号时，normalize 逻辑会补引号（不影响梯形 `[/.../]`）
- **聊天围栏工具栏**
  - [ ] 开启 `enableChatCodeFenceToolbar` 后，代码块包含工具栏与按钮属性 `data-chat-code-action`
  - [ ] `bindMarkdownCodeFenceActions` 能正确解析点击并回调 `onCopy`/`onDownload`/`onAction`
  - [ ] 默认复制能写入剪贴板，且按钮出现“已复制”反馈并自动恢复
  - [ ] 下载路径能得到 `Blob` 与合理的默认文件名 `code.<ext>`（语言映射正确）

