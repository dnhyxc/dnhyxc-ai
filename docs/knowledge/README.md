# 知识库专题文档

路径前缀：`apps/frontend` 知识页 + `apps/backend` 知识/RAG 模块。

---

## 总览与权威长文

| 文档 | 说明 |
|------|------|
| **[knowledge-assistant-complete.md](./knowledge-assistant-complete.md)** | 右侧 Assistant **总览**（状态机、SSE、持久化、UI） |
| [siliconflow-chat-unification.md](../backend/siliconflow-chat-unification.md) | 助手 / RAG / 主 Chat **LLM 接入**（硅基 + ChatOpenAI，主文档在 backend） |
| [knowledge-rag-implementation-backend.md](./knowledge-rag-implementation-backend.md) | RAG 后端实现 |
| [knowledge-rag-qa-assistant-frontend.md](./knowledge-rag-qa-assistant-frontend.md) | RAG 问答前端 |
| [rag-retrieval-nestjs-react-qdrant.md](./rag-retrieval-nestjs-react-qdrant.md) | Qdrant 检索链路 |

---

## 助手：问题修复与专题

| 文档 | 说明 |
|------|------|
| [knowledge-assistant-mermaid-streaming.md](./knowledge-assistant-mermaid-streaming.md) | 流式 ` ```mermaid ` 不出图 |
| [knowledge-assistant-streaming-across-documents.md](./knowledge-assistant-streaming-across-documents.md) | 切文档后流式状态丢失 |
| [knowledge-assistant-ephemeral-persistence.md](./knowledge-assistant-ephemeral-persistence.md) | 未保存草稿 ephemeral |
| [knowledge-assistant-prompt-cards.md](./knowledge-assistant-prompt-cards.md) | 快捷卡片 |
| [knowledge-assistant-outline-toc-prepend.md](./knowledge-assistant-outline-toc-prepend.md) | 大纲 TOC prepend |
| [knowledge-assistant-layout-scrollbar-alignment.md](./knowledge-assistant-layout-scrollbar-alignment.md) | 滚动条对齐 |
| [knowledge-editor-send-selection-to-assistant-dedupe.md](./knowledge-editor-send-selection-to-assistant-dedupe.md) | 选中发送到助手去重 |
| [knowledge-assistant-insert-selection-ai-rag.md](./knowledge-assistant-insert-selection-ai-rag.md) | 选中写入 AI/RAG 输入框 |
| [knowledge-assistant-multi-session-frontend-implementation.md](./knowledge-assistant-multi-session-frontend-implementation.md) | 多会话前端 |
| [knowledge-assistant-multi-session-backend-implementation.md](./knowledge-assistant-multi-session-backend-implementation.md) | 多会话后端 |

`knowledge-assistant-complete.md` 文首「问题修复记录」汇总上述链接；新增修复文时请同步该节。

---

## 编辑器、本地与导入

| 文档 |
|------|
| [local-folder-and-monaco-sync.md](./local-folder-and-monaco-sync.md) |
| [knowledge-md-import.md](./knowledge-md-import.md) |
| [auto-save.md](./auto-save.md) |
| [shortcuts.md](./shortcuts.md) |
| [unauthenticated-local-only.md](./unauthenticated-local-only.md) |

---

## 相关（包外）

- Markdown / Mermaid 工具包：[../tools/index.md](../tools/index.md)
- Monaco 预览：[../monaco/](../monaco/)
- Mermaid UI：[../mermaid/](../mermaid/)

上级索引：[../README.md](../README.md)
