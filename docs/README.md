# 开发文档索引

本目录存放**实现思路、问题修复记录、部署说明**等专题文档，面向维护者与贡献者。面向最终用户的产品说明见 [`project-guide.md`](./project-guide.md)。

**约定**：文档描述以仓库**当前源码**为准；若与代码冲突，以代码为准。换 COS 桶或 CDN 域名时，需同步前后端 `.env`、`Info.plist`、`capabilities` 与 Nginx（见 [COS 对象存储](./backend/cos-object-storage.md) §5、[七牛/COS 展示代理](./frontend/qiniu-dev-http-proxy.md)）。

---

## 按功能域浏览

| 目录                         | 说明                                            | 入口                                                                   |
| ---------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| [`frontend/`](./frontend/)   | 前端页面、路由鉴权、英语学习、Tauri、七牛展示等 | [frontend/README.md](./frontend/README.md)                             |
| [`knowledge/`](./knowledge/) | 知识库、RAG、右侧 Assistant、本地/云端草稿      | [knowledge/README.md](./knowledge/README.md)                           |
| [`backend/`](./backend/)     | NestJS、部署、LLM 接入、英语学习后端            | [backend/README.md](./backend/README.md)                               |
| [`monaco/`](./monaco/)       | Monaco / Markdown 编辑器行为与修复              | 按文件名检索                                                           |
| [`mermaid/`](./mermaid/)     | Mermaid 围栏、预览缩放、工具栏                  | [markdown-zoom-and-preview.md](./mermaid/markdown-zoom-and-preview.md) |
| [`chat/`](./chat/)           | 主站对话、分享、联网搜索、附件预览              | [chat/README.md](./chat/README.md)                                   |
| [`tools/`](./tools/)         | `@dnhyxc-ai/markdown-kit` 等工具包              | [tools/index.md](./tools/index.md)                                     |
| [`react/`](./react/)         | React Hooks 专题                                | 按文件名检索                                                           |
| [`meta/`](./meta/)           | 发布、功能更新说明                              | [meta/project-features-update.md](./meta/project-features-update.md)   |
| [`setting/`](./setting/)     | 系统快捷键等                                    | 按文件名检索                                                           |

---

## 常见排查（快捷链）

| 现象                                     | 优先阅读                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 头像/COS 上传失败 AccessDenied           | [backend/cos-object-storage.md](./backend/cos-object-storage.md) §3.4、§6                                        |
| COS/七牛 图能传不能显（403 / ATS）       | [backend/cos-object-storage.md](./backend/cos-object-storage.md) §3.3 + [frontend/qiniu-dev-http-proxy.md](./frontend/qiniu-dev-http-proxy.md) |
| COS 图能预览但下载失败                 | [backend/cos-object-storage.md](./backend/cos-object-storage.md) §3.7、§6 |
| Web HTTPS 头像 mixed content             | 同上 + [frontend/route-auth.md](./frontend/route-auth.md) §12 + [backend/nginx.md](./backend/nginx.md) `/ext-cos/` |
| Tauri macOS 生产包 HTTP 被拦             | [frontend/tauri-macos-ats-http.md](./frontend/tauri-macos-ats-http.md)                                             |
| 知识库助手流式 Mermaid 不出图            | [knowledge/knowledge-assistant-mermaid-streaming.md](./knowledge/knowledge-assistant-mermaid-streaming.md)         |
| 知识库助手总览                           | [knowledge/knowledge-assistant-complete.md](./knowledge/knowledge-assistant-complete.md)                           |
| 对话模型统一硅基接入                     | [backend/siliconflow-chat-unification.md](./backend/siliconflow-chat-unification.md)                               |
| 聊天附件上传后预览失败 / NotSameOrigin   | [chat/chat-upload-preview.md](./chat/chat-upload-preview.md)                                                       |
| 线上 `/images/` 400、9002 附件打不开     | [chat/chat-upload-access-prod.md](./chat/chat-upload-access-prod.md) + [backend/nginx.md](./backend/nginx.md)      |
| 上传落盘路径 / dist 清空丢附件 / UPLOAD_ROOT | [backend/upload-storage-paths.md](./backend/upload-storage-paths.md)                                             |
| 单词包拉取 400 / 模型名与硅基端点不匹配  | [backend/create-llm.md](./backend/create-llm.md) §5.2                                                              |
| `createLlm` 工厂与 preset                | [backend/create-llm.md](./backend/create-llm.md)                                                                   |
| 设置页改大模型 Key/URL/模型名            | [backend/llm-runtime-settings.md](./backend/llm-runtime-settings.md)                                             |
| 英语学习 Agent 流式对话接 `createLlm`    | [backend/agent-create-llm-unify.md](./backend/agent-create-llm-unify.md)                                           |

---

## 文档类型说明

- **实现思路 / 修复记录**：文件名多为 `*-implementation*`、`*-complete*`、具体 bug 描述；含代码摘录与回归建议。
- **部署 / 运维**：`backend/deploy.md`、`server-deployment.md`、`nginx.md`、`backend/upload-storage-paths.md`。
- **用户向**：`project-guide.md`（产品教程），应用内「更新说明」与 `meta/` 姊妹维护。

新增专题文档时，请在对应子目录的 `README.md` 中补一行索引，避免只在深层目录孤立存在。
