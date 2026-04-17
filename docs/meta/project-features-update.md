# 项目功能与文档总览

本文是 **`docs/` 目录下各专题文档的汇总索引**，并用一条主线说明本仓库**已实现的主要产品能力**与对应文档入口。  
**细节实现、逐行代码走读仍以各专文为准**；若专文与源码冲突，以源码为单一事实来源。

---

## 1. 仓库与包（便于对照文档路径）

| 区域                      | 说明                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `apps/frontend`           | React + Vite 前端；知识库、聊天、设置、路由与 Tauri/Web 双端适配     |
| `apps/backend`            | NestJS 后端；会话、流式对话、队列落库等（见 `chatbot.md`）           |
| `apps/frontend/src-tauri` | Tauri 2 桌面壳；知识库本地目录、系统命令等                           |
| `packages/tools`          | 发布为 `@dnhyxc-ai/tools`：Markdown 解析、样式、Mermaid React 辅助等 |

---

## 2. 功能总览（按产品 / 技术域）

### 2.1 用户与访问控制

- **路由级登录守卫**：无有效 token 时，非公开路径进入主布局前跳转登录页。
- **HTTP 401 统一处理**：清会话、按需整页回登录，与路由守卫互补。
- **公开路径白名单**：首页、登录、关于、分享页、设置等可未登录访问。

**文档**：[`frontend/route-auth.md`](../frontend/route-auth.md)

---

### 2.2 桌面（Tauri）与浏览器双端

- **同一套前端**在 Tauri WebView 与独立浏览器中运行；运行时检测 `isTauriRuntime()`。
- **网络 / 存储 / 剪贴板 / 下载 / 更新器**等在非 Tauri 环境降级为 Web API 或提示。
- **避免入口链顶层 await 调 Tauri**，防止浏览器白屏。

**文档**：[`frontend/tauri-browser.md`](../frontend/tauri-browser.md)

---

### 2.3 对话（Chatbot）

- **后端**：会话创建、SSE 流式、停止/续写、智谱并行路线、Serper 联网与引用锚点、附件与 OCR、BullMQ 异步落库等。
- **前端**：MobX `chatStore`、`useChatCore`、连接层与 **`ChatBotView`** 纯 UI 分离、SSE JSON 解析、分支对话、滚动与锚点导航等。

**文档**：[`chat/chatbot.md`](../chat/chatbot.md)（架构与 API 说明）  
**近期改动详录**（偏更新日志 + 大段注释摘录）：[`update.md`](./update.md)

---

### 2.4 Markdown 工具包（`@dnhyxc-ai/tools`）

- **`MarkdownParser`**：`MarkdownIt` + KaTeX + GFM 待办补丁 + highlight.js；可选聊天围栏工具栏、Mermaid 占位、标题行号 `data-md-heading-line`、拆岛 **`splitForMermaidIslands`**（含 **`lineBase0`** 全文行号语义）等。
- **样式产物**：`github-markdown`、KaTeX、全量 hljs 主题映射与类型安全 id。
- **运行时主题注入**：CDN 或内联 CSS。
- **React 子路径**：`useMermaidInMarkdownRoot` 等。

**文档**：[`tools/index.md`](../tools/index.md)

---

### 2.5 知识库（Markdown 编辑与列表）

- **云端列表 / 详情 / 保存**：与登录态、Store 分页配合。
- **未登录**：不调云端知识库接口；默认本地文件夹模式；隐藏回收站等。

**文档**：[`knowledge/unauthenticated-local-only.md`](../knowledge/unauthenticated-local-only.md)

- **本地文件夹**：递归 `.md`、读盘写盘、合成 id、与云端保存分支；**在外部编辑器打开**（Cursor / Trae 等）；Monaco 清空与父状态对齐。

**文档**：[`knowledge/local-folder-and-monaco-sync.md`](../knowledge/local-folder-and-monaco-sync.md)

- **自动保存**：防抖、与「覆盖保存」绑定、静默策略、保存前从编辑器取最新正文等。

**文档**：[`knowledge/auto-save.md`](../knowledge/auto-save.md)

- **页面内快捷键（chord）**：仅知识库生效、系统设置录制、捕获阶段与 Monaco 共存、`MarkdownEditor` 底部栏受控等。

**文档**：[`knowledge/shortcuts.md`](../knowledge/shortcuts.md)

---

### 2.6 Monaco Markdown 编辑器（知识库等复用）

- **中文 IME 重影 / 叠字**：受控 value、透明主题、占位与多行折行等成因与缓解（含 Tab/缩进说明）；**分屏跟滚**历史叙述见该文 §5，**现行算法**以下文专文为准。

**文档**：[`monaco/markdown-ime-ghosting.md`](../monaco/markdown-ime-ghosting.md)

- **分屏跟随滚动（现行）**：`MarkdownScrollSyncSnapshot` 单调折线、`getScrollTop()` 插值、标题 DOM 与 `getTopForLineNumber` 对齐；**Mermaid 分段渲染**下 `lineBase0` + HTML 行号平移；`splitPaneMarkdown`、`scrollTopChanged`、回声抑制与快照重建时机。

**文档**：[`monaco/markdown-split-scroll-sync.md`](../monaco/markdown-split-scroll-sync.md)

- **Tauri / WebView 下布局**：关闭 `automaticLayout`，宿主测量 + 显式 `layout()`、ResizeObserver / rAF、flex 约束等。

**文档**：[`monaco/editor-tauri-layout.md`](../monaco/editor-tauri-layout.md)

- **剪贴板**：Monaco 内 `addCommand` 绑定 C/X/V；普通 input/textarea 在 Tauri 下窄范围快捷键，避免与 Monaco 选区冲突。

**文档**：[`monaco/clipboard-global-handler-bypass.md`](../monaco/clipboard-global-handler-bypass.md)

---

### 2.7 Markdown 围栏、格式化与 Mermaid 呈现

- **按行围栏解析**：避免注释/JSDoc 内 \`\`\` 误匹配；供安全格式化、尾部开放 mermaid 探测等；与 **markdown-it `splitForMermaidIslands`** 主路径的关系。

**文档**：[`tools/markdown-fence-line-parser.md`](../tools/markdown-fence-line-parser.md)

- **Mermaid 在正文中的两条路径**：整段 HTML + 根扫描 vs 拆岛 + 流式；缩放/平移、点击大图预览、与预览/聊天宿主的约定。

**文档**：[`mermaid/markdown-zoom-and-preview.md`](../mermaid/markdown-zoom-and-preview.md)

- **Mermaid 占位 DOM 契约（选择器/HTML 片段）收口**：`packages/tools/src/mermaid/markdown-selectors.ts` 集中导出 **`MERMAID_MARKDOWN_*`**、`closestMermaidMarkdownWrap`、`MARKDOWN_MERMAID_PLACEHOLDER_HTML` 等，与 **`MarkdownParser.patchMermaidFence`**、**`runMermaidInMarkdownRoot`**、前端岛/工具栏/预览 **同源**，避免业务侧散落 `.markdown-mermaid-wrap` 字符串难维护。

**文档**：[`tools/index.md`](../tools/index.md) **§11.2.1**（动机与 API 表）、**§11.2.2**（**带行尾 `//` 中文注释** 的实现源码摘录：契约模块 / `runMermaidInMarkdownRoot` / `patchMermaidFence` 节选 / 岛与 Hook 与工具栏节选）；[`tools/usage-guide.md`](../tools/usage-guide.md) **§8.5**（使用者示例，同样行尾注释）

- **Markdown 围栏代码块（复制/下载工具栏）DOM 契约**：`packages/tools/src/markdown/code-fence-dom.ts` 集中导出 **`MARKDOWN_CODE_FENCE_*`**、`queryMarkdownCodeFenceBlockRoots`；与 **`MarkdownParser.patchChatCodeFenceRenderer`**、**`markdown/code-fence-actions.ts`**、前端 **`layoutChatCodeToolbars`** **同源**，避免业务侧散落 `[data-chat-code-block]` 等字符串。

**文档**：[`tools/index.md`](../tools/index.md) **第 11.8.6.0 小节**（动机、方案、维护约定、**带行尾 `//` 中文注释** 的源码摘录）；[`tools/usage-guide.md`](../tools/usage-guide.md) **第 7.6.0 小节**（从包内 import 的短示例）

- **`packages/tools/src` 源码按功能分目录（重组，不改变对外 API）**：将 Markdown / Mermaid / highlight.js 相关源码分别归入 `markdown/`、`mermaid/`、`highlight/`；仅调整内部相对 import 与构建脚本生成路径，**使用方仍从 `@dnhyxc-ai/tools` / `@dnhyxc-ai/tools/react` 导入**，不需要变更业务侧 import。

**文档**：[`tools/index.md`](../tools/index.md) **第 1.1 小节**（完整实现思路：约束、目录规划、迁移步骤、验证与常见误区）

- **Mermaid 围栏工具条**：`sticky` + 哨兵 `IntersectionObserver` 双态样式；与代码块 Portal 吸顶方案差异；下载 SVG/DSL；Monaco 预览侧对齐。

**文档**：[`mermaid/fence-toolbar-sticky.md`](../mermaid/fence-toolbar-sticky.md)

---

### 2.8 聊天 Markdown 中的代码块吸顶工具条

- **`useChatCodeFloatingToolbar`**：在 ScrollArea viewport 上绑定 resize/scroll/ResizeObserver，调用 **`layoutChatCodeToolbars`**，由 Portal 浮动层展示吸顶工具栏。
- **`useSyncExternalStore`**：与 `ChatCodeToolbarFloating`、模块级布局 store 的配合说明。

**文档**：[`react/use-chat-code-floating-toolbar.md`](../react/use-chat-code-floating-toolbar.md)、[`react/useSyncExternalStore.md`](../react/useSyncExternalStore.md)

---

## 3. `docs/` 文档目录（全量索引）

| 文档 | 一句话说明 |
| --- | --- |
| [project-guide.md](../project-guide.md) | 面向普通用户的产品功能详解与使用教程 |
| [meta/project-features-update.md](./project-features-update.md) | **本文**：项目功能与文档总览（索引入口） |
| [meta/update.md](./update.md) | ChatBot 相关近期提交与代码级改动摘录（更新日志向；本文件位于 `docs/meta/`，因此链接目标仍是同目录 `./update.md`） |
| [tools/index.md](../tools/index.md) | `@dnhyxc-ai/tools` 包能力、构建、样式与 `MarkdownParser` |
| [tools/usage-guide.md](../tools/usage-guide.md) | `@dnhyxc-ai/tools` 使用者上手指南与完整示例 |
| [frontend/route-auth.md](../frontend/route-auth.md) | 前端路由守卫与 401 鉴权收口 |
| [frontend/tauri-browser.md](../frontend/tauri-browser.md) | Tauri / 浏览器双端运行改造 |
| [knowledge/auto-save.md](../knowledge/auto-save.md) | 知识库自动保存（防抖）与保存语义 |
| [knowledge/shortcuts.md](../knowledge/shortcuts.md) | 知识库页面内快捷键与设置联动 |
| [knowledge/unauthenticated-local-only.md](../knowledge/unauthenticated-local-only.md) | 未登录仅本地、隐藏回收站等 |
| [knowledge/local-folder-and-monaco-sync.md](../knowledge/local-folder-and-monaco-sync.md) | 本地文件夹列表、Rust 命令、Monaco 清空同步 |
| [monaco/markdown-ime-ghosting.md](../monaco/markdown-ime-ghosting.md) | Monaco Markdown IME 重影与分屏相关历史说明 |
| [monaco/markdown-split-scroll-sync.md](../monaco/markdown-split-scroll-sync.md) | **现行**分屏跟随滚动算法与拆岛行号 |
| [monaco/editor-tauri-layout.md](../monaco/editor-tauri-layout.md) | Monaco 在 Tauri 下的显式布局 |
| [monaco/clipboard-global-handler-bypass.md](../monaco/clipboard-global-handler-bypass.md) | Monaco 与普通输入框剪贴板策略 |
| [tools/markdown-fence-line-parser.md](../tools/markdown-fence-line-parser.md) | 围栏按行解析与安全格式化 |
| [mermaid/markdown-zoom-and-preview.md](../mermaid/markdown-zoom-and-preview.md) | Mermaid 缩放、预览路径与数据流 |
| [mermaid/fence-toolbar-sticky.md](../mermaid/fence-toolbar-sticky.md) | Mermaid 围栏工具条吸顶与下载 |
| [react/use-chat-code-floating-toolbar.md](../react/use-chat-code-floating-toolbar.md) | 聊天代码块浮动工具条 Hook 走读 |
| [react/useSyncExternalStore.md](../react/useSyncExternalStore.md) | useSyncExternalStore 与浮动工具栏 store |
| [chat/chatbot.md](../chat/chatbot.md) | Chatbot 前后端架构、路由、流式、联网、落库 |

---

## 4. 维护约定（给后续贡献者）

1. **新增专题**：在 `docs/` 下新增 `.md` 后，**请在本手册 §3 表格中增加一行**，并在 §2 对应小节补一句交叉引用（若开新域则加新小节）。
2. **大功能迁移**（例如跟滚算法换代）：专文写清「现行实现」；旧文可在开篇增加「参见 xxx」避免双套叙述（参考 `monaco-markdown-ime-ghosting.md` 与 `monaco-markdown-split-scroll-sync.md` 的关系）。
3. **产品功能清单**：以本手册 §2 为**入口**；实现细节与文件路径以各专文内的表格与代码摘录为准。

---

_文档生成说明：根据当前 `docs/` 目录下全部专题文档归纳；若仓库新增页面或包，请同步更新 §2 / §3。_
