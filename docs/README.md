# 开发文档索引

本目录按**功能域**组织实现说明与排查文档。面向最终用户的产品说明见 [`project-guide.md`](./project-guide.md)、[`project-update-info.md`](./project-update-info.md)。

**约定**：以仓库**当前源码**为准。换 COS 桶时同步前后端 `.env`、Tauri allowlist 与 Nginx（见 [cos/cos-object-storage.md](./cos/cos-object-storage.md) §5、[cos/cos-dev-http-proxy.md](./cos/cos-dev-http-proxy.md)）。

---

## 功能域目录（简短命名）

| 目录 | 说明 | 入口 |
|------|------|------|
| [`chat/`](./chat/) | 主站对话、分享、联网、附件 | [chat/README.md](./chat/README.md) |
| [`knowledge/`](./knowledge/) | 知识库、RAG、文档助手 | [knowledge/README.md](./knowledge/README.md) |
| [`english/`](./english/) | 英语学习（词包、收藏、TTS、Agent） | [english/README.md](./english/README.md) |
| [`cos/`](./cos/) | 腾讯云 COS 上传与 `/ext-cos/` 展示 | [cos/README.md](./cos/README.md) |
| [`llm/`](./llm/) | 大模型接入（硅基、`createLlm`、设置页） | [llm/README.md](./llm/README.md) |
| [`ops/`](./ops/) | 部署、Nginx、本地上传目录 | [ops/README.md](./ops/README.md) |
| [`app/`](./app/) | 前端壳层：路由鉴权、Tauri、i18n | [app/README.md](./app/README.md) |
| [`monaco/`](./monaco/) | Monaco / Markdown 编辑器 | 按文件名检索 |
| [`mermaid/`](./mermaid/) | Mermaid 围栏与预览 | [mermaid/markdown-zoom-and-preview.md](./mermaid/markdown-zoom-and-preview.md) |
| [`tools/`](./tools/) | `@dnhyxc-ai/markdown-kit` | [tools/index.md](./tools/index.md) |
| [`react/`](./react/) | React Hooks 专题 | 按文件名检索 |
| [`setting/`](./setting/) | 系统快捷键 | [setting/system-shortcuts-implementation-record.md](./setting/system-shortcuts-implementation-record.md) |
| [`meta/`](./meta/) | 发布与更新同步 | [meta/project-features-update.md](./meta/project-features-update.md) |

---

## 常见排查

| 现象 | 优先阅读 |
|------|----------|
| COS 上传 AccessDenied | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.4、§6 |
| COS 能传不能显（403 / ATS） | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.3 + [cos/cos-dev-http-proxy.md](./cos/cos-dev-http-proxy.md) |
| COS 能预览但下载失败 | [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.7 |
| 分享页无用户附件 | [chat/share.md](./chat/share.md) §五 + [cos/cos-object-storage.md](./cos/cos-object-storage.md) §3.9 |
| Web HTTPS mixed content | 同上 + [app/route-auth.md](./app/route-auth.md) §12 + [ops/nginx.md](./ops/nginx.md) |
| Tauri macOS ATS | [app/tauri-macos-ats-http.md](./app/tauri-macos-ats-http.md) |
| 知识库助手 Mermaid 流式 | [knowledge/knowledge-assistant-mermaid-streaming.md](./knowledge/knowledge-assistant-mermaid-streaming.md) |
| 知识库助手总览 | [knowledge/knowledge-assistant-complete.md](./knowledge/knowledge-assistant-complete.md) |
| 对话硅基接入 | [llm/siliconflow-chat-unification.md](./llm/siliconflow-chat-unification.md) |
| 聊天附件预览失败 | [chat/chat-upload-preview.md](./chat/chat-upload-preview.md) |
| 生产 `/images/` 400 | [chat/chat-upload-access-prod.md](./chat/chat-upload-access-prod.md) + [ops/nginx.md](./ops/nginx.md) |
| 本地上传落盘 / UPLOAD_ROOT | [ops/upload-storage-paths.md](./ops/upload-storage-paths.md) |
| `createLlm` / 400 | [llm/create-llm.md](./llm/create-llm.md) |
| 设置页大模型 Key | [llm/llm-runtime-settings.md](./llm/llm-runtime-settings.md) |
| 英语学习 Agent + LLM | [llm/agent-create-llm-unify.md](./llm/agent-create-llm-unify.md) |

---

## 文档类型

- **实现 / 修复**：各域下 `*-implementation*`、`*-complete*` 或专题名 md。
- **运维**：`ops/deploy.md`、`ops/nginx.md`、`ops/server-deployment.md`。
- **用户向**：根目录 `project-guide.md`、`project-update-info.md`（正文不出现仓库路径）。

新增专题时请在对应域 `README.md` 登记一行，并视需要更新本表「常见排查」。
