# wiki/ 功能域目录与落盘规则

专题实现文**必须**落在与改动**产品功能**一致的 `<WIKI_ROOT>/<功能域>/` 下，**禁止**再使用已废弃的 `backend/`、`frontend/` 等按技术栈划分的顶层目录；**禁止**再往本仓 `docs/` 落新专题。

| 写法 | 路径 |
|------|------|
| **绝对路径（权威）** | `/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/` |
| **相对本仓（dnhyxc-ai）** | `../micro-apps/remote-docs/wiki/` |

权威登记表：[`<WIKI_ROOT>/README.md`](../../../../../micro-apps/remote-docs/wiki/README.md)（绝对路径：`/Users/dnhyxc/Documents/code/micro-apps/remote-docs/wiki/README.md`）。

**规划态**文 → `<WIKI_ROOT>/ideas/`（Skill：`feature-implementation-idea`）；**本 Skill 不要**写进 `ideas/`。

---

## 1. 如何选择功能域

按**用户/维护者关心的能力**选目录，不按 `apps/backend` vs `apps/frontend` 路径选目录。

| 改动涉及 | 落盘目录 | 典型源码前缀（仅供对照） |
|----------|----------|-------------------------|
| 主站对话、分享、联网、聊天附件 | `<WIKI_ROOT>/chat/` | `apps/backend/src/services/chat/`、`apps/frontend/src/views/chat/`、`ChatBot` |
| 知识库、RAG、文档助手、本地文件夹 | `<WIKI_ROOT>/knowledge/` | `apps/frontend/src/views/knowledge/`、knowledge/assistant 后端 |
| 英语学习（词包、收藏、TTS、Agent） | `<WIKI_ROOT>/english/` | `english-learning`、`agent` 英语学习 |
| 腾讯云 COS 上传、`/ext-cos/` 展示 | `<WIKI_ROOT>/cos/` | `upload/cos`、`resolveCosUrl*`、vite `/ext-cos` |
| 大模型接入（硅基、`createLlm`、设置页 LLM） | `<WIKI_ROOT>/llm/` | `create-llm`、`llm-runtime-settings`、`siliconflow` |
| 部署、Nginx、本地上传 `uploads/` | `<WIKI_ROOT>/ops/` | `deploy`、`nginx`、`upload-paths` |
| 路由守卫、401、Tauri、i18n、登录流程 | `<WIKI_ROOT>/app/` | `router/`、`src-tauri/`、全局 `utils` 横切（非单一业务页） |
| Monaco / Markdown 编辑器 | `<WIKI_ROOT>/monaco/` | `MarkdownEditor`、`monaco` |
| Mermaid 围栏、预览缩放 | `<WIKI_ROOT>/mermaid/` | `Mermaid`、`markdown-kit` 图表 |
| `@dnhyxc-ai/markdown-kit` 包 | `<WIKI_ROOT>/tools/` | `packages/markdown-kit` |
| React Hooks 通用模式 | `<WIKI_ROOT>/react/` | `hooks/` 且**无**单一业务域 |
| 系统快捷键 | `<WIKI_ROOT>/setting/` | `views/setting/system` |
| 发布、更新页同步脚本 | `<WIKI_ROOT>/meta/` | `scripts/release`、`update-info` 生成 |
| 电子书书架、EPUB/PDF | `<WIKI_ROOT>/ebook/` | `ebook`、`epub` |
| Agent 分表 / Skill 后端 | `<WIKI_ROOT>/agent/` | `services/agent`、`services/skill` |
| 改动影响面 | `<WIKI_ROOT>/impact/` | Influence-point 类分析 |
| 插件 / MF | `<WIKI_ROOT>/plugins/` | `plugins`、federation |
| Tauri 桌面特性 | `<WIKI_ROOT>/tauri/` | `src-tauri` |
| 认证 | `<WIKI_ROOT>/auth/` | 路由守卫、登录 |
| 样式隔离 | `<WIKI_ROOT>/style/` | `@scope`、Portal |
| 视频 | `<WIKI_ROOT>/video/` | 播放器 |
| 国际化 | `<WIKI_ROOT>/i18n/` | locales |
| 通用 UI | `<WIKI_ROOT>/ui/` | 组件/交互 |
| 支付 | `<WIKI_ROOT>/pay/` | Stripe |

**跨域改动（一轮含多个独立功能）**：

- **每个独立功能各写一篇**专题，分别落在各自功能域（例如 `<WIKI_ROOT>/chat/助手分享条.md` + `<WIKI_ROOT>/ebook/本地路径去重.md`）。
- 文首「延伸阅读」互链；`<WIKI_ROOT>/README.md` 或各域 `README.md` 可增一行索引。
- **不要**合并成「本轮总文档」塞进某一个域。
- **同一功能**的前端 + 后端仍写在**一篇**专题内（按 ### 分模块），**不要**按 `backend/` vs `frontend/` 拆成两篇技术栈文档。

**仅根目录**（不写进子目录）：`<WIKI_ROOT>/项目指南.md`、`<WIKI_ROOT>/项目更新信息.md`（产品向姊妹稿）。

**禁止**：`<WIKI_ROOT>/ideas/`（规划态）、本仓 `docs/` 新专题。

---

## 2. 命名约定

- **功能域目录名**：短英文（上表）。
- **禁止**恢复 `backend/`、`frontend/`；历史链接应改指向上表对应域。
- 新目录名建议 **2～8 个字符**；创建后必须在 `<WIKI_ROOT>/README.md`「功能域目录」表增一行。
- **专题 `.md` 文件名**：**简体中文**、简短、语义明确（细则见 SKILL §4）；示例 `<WIKI_ROOT>/chat/助手分享条.md`。

---

## 3. 新建功能域目录

落盘前检查 `<WIKI_ROOT>/<功能域>/` 是否存在：

1. **无此目录** → 创建 `<WIKI_ROOT>/<功能域>/`。
2. **无 `README.md`** → 新建 `<WIKI_ROOT>/<功能域>/README.md`（一句话说明该域职责 + 表格索引已有/本轮新增专题）。
3. 在 `<WIKI_ROOT>/README.md` 的「功能域目录」表补一行入口。
4. 若现象适合排查表 → 在 `<WIKI_ROOT>/README.md`「常见排查」补链。

不得把专题文直接写在 `<WIKI_ROOT>/` 根下（姊妹稿除外）；不得写进本仓 `docs/`。

---

## 4. 从源码路径反推功能域（速查）

| 源码线索 | 优先域 |
|----------|--------|
| `views/chat`、`services/chat`、分享 | `chat` |
| `views/knowledge`、RAG、assistant 知识库 | `knowledge` |
| `english-learning`、`englishAgent` | `english` |
| `ebook`、`epub` | `ebook` |
| `skill`、`agent`、`memorySource` | `agent` 或 `knowledge`（Skill 页 UI 偏 knowledge） |
| `create-llm`、硅基 | `llm` |
| `cos`、`ext-cos` | `cos` |
| `src-tauri` 窗口/菜单 | `tauri` 或 `app` |
| Monaco | `monaco` |

---

## 5. 自检（落盘前）

- [ ] 专题路径是否为 `<WIKI_ROOT>/<功能域>/<简短中文文件名>.md`（非英文 kebab-case）？
- [ ] `<功能域>` 是否在 `<WIKI_ROOT>/README.md` 已登记？
- [ ] 是否误用 `backend/`、`frontend/`、根目录、`ideas/`，或误写本仓 `docs/`？
