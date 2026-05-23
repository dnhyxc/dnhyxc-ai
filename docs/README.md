# 开发文档索引

本目录存放**实现思路、问题修复记录、部署说明**等专题文档，面向维护者与贡献者。面向最终用户的产品说明见 [`project-guide.md`](./project-guide.md)。

**约定**：文档描述以仓库**当前源码**为准；若与代码冲突，以代码为准。换七牛桶、改 CDN 域名时，需同步 `.env`、`Info.plist`、`capabilities` 与 Nginx（见 [七牛 HTTP 展示代理](./frontend/qiniu-dev-http-proxy.md) §6–§8）。

---

## 按功能域浏览

| 目录 | 说明 | 入口 |
|------|------|------|
| [`frontend/`](./frontend/) | 前端页面、路由鉴权、英语学习、Tauri、七牛展示等 | [frontend/README.md](./frontend/README.md) |
| [`knowledge/`](./knowledge/) | 知识库、RAG、右侧 Assistant、本地/云端草稿 | [knowledge/README.md](./knowledge/README.md) |
| [`backend/`](./backend/) | NestJS、部署、Nginx、英语学习后端 | [backend/server-deployment.md](./backend/server-deployment.md)、[backend/nginx.md](./backend/nginx.md) |
| [`monaco/`](./monaco/) | Monaco / Markdown 编辑器行为与修复 | 按文件名检索 |
| [`mermaid/`](./mermaid/) | Mermaid 围栏、预览缩放、工具栏 | [markdown-zoom-and-preview.md](./mermaid/markdown-zoom-and-preview.md) |
| [`chat/`](./chat/) | 主站对话、分享、联网搜索 | [chatbot.md](./chat/chatbot.md) |
| [`tools/`](./tools/) | `@dnhyxc-ai/markdown-kit` 等工具包 | [tools/index.md](./tools/index.md) |
| [`react/`](./react/) | React Hooks 专题 | 按文件名检索 |
| [`meta/`](./meta/) | 发布、功能更新说明 | [meta/project-features-update.md](./meta/project-features-update.md) |
| [`setting/`](./setting/) | 系统快捷键等 | 按文件名检索 |

---

## 常见排查（快捷链）

| 现象 | 优先阅读 |
|------|----------|
| 七牛能上传、本地/Tauri 图片不显示（ATS） | [frontend/qiniu-dev-http-proxy.md](./frontend/qiniu-dev-http-proxy.md) |
| Web HTTPS 头像 mixed content | 同上 + [frontend/route-auth.md](./frontend/route-auth.md) §12 + [backend/nginx.md](./backend/nginx.md) `/ext-img/` |
| Tauri macOS 生产包 HTTP 被拦 | [frontend/tauri-macos-ats-http.md](./frontend/tauri-macos-ats-http.md) |
| 知识库助手流式 Mermaid 不出图 | [knowledge/knowledge-assistant-mermaid-streaming.md](./knowledge/knowledge-assistant-mermaid-streaming.md) |
| 知识库助手总览 | [knowledge/knowledge-assistant-complete.md](./knowledge/knowledge-assistant-complete.md) |

---

## 文档类型说明

- **实现思路 / 修复记录**：文件名多为 `*-implementation*`、`*-complete*`、具体 bug 描述；含代码摘录与回归建议。
- **部署 / 运维**：`backend/deploy.md`、`server-deployment.md`、`nginx.md`。
- **用户向**：`project-guide.md`（产品教程），应用内「更新说明」与 `meta/` 姊妹维护。

新增专题文档时，请在对应子目录的 `README.md` 中补一行索引，避免只在深层目录孤立存在。
