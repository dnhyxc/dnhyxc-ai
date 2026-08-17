# 知识库专题文档

路径前缀：`apps/frontend` 知识页 + `apps/backend` 知识/RAG 模块。

---

## 总览与权威长文

| 文档 | 说明 |
|------|------|
| **[knowledge-assistant-complete.md](./knowledge-assistant-complete.md)** | 右侧 Assistant **总览**（状态机、SSE、持久化、UI） |
| [siliconflow-chat-unification.md](../llm/siliconflow-chat-unification.md) | 助手 / RAG / 主 Chat **LLM 接入**（硅基 + ChatOpenAI） |
| [knowledge-rag-implementation-backend.md](./knowledge-rag-implementation-backend.md) | RAG 后端实现 |
| [siliconflow-vector-full-url.md](./siliconflow-vector-full-url.md) | **向量完整 URL**（`SILICONFLOW_EMBEDDING_URL` / 分片档位 / 入库 400 修复） |
| [knowledge-vector-create-llm.md](./knowledge-vector-create-llm.md) | **向量 embedding/rerank 凭证**收敛至 `create-llm` |
| [knowledge-member-vector-tier.md](./knowledge-member-vector-tier.md) | **会员 Qwen3 向量 + 双 collection 检索**（兼容 1024 存量） |
| [user-vector-rag-config.md](./user-vector-rag-config.md) | **用户向量设置 + 多库 RAG**（独立保存、profiles 累积、系统默认 bge 始终检索） |
| [vector-bge-global-round.md](./vector-bge-global-round.md) | **全站仅 BGE**、入库分批/Unicode、会员默认 4B 库、设置页保存与表单 |
| [knowledge-chunk-boundaries.md](./knowledge-chunk-boundaries.md) | **向量分片语义边界**（代码围栏、按行切、`console.log` 防截断） |
| [knowledge-chunk-infinite-loop-oom.md](./knowledge-chunk-infinite-loop-oom.md) | **分片死循环 / OOM**（`splitByLinesOnly` overlap 不前进、`KNOWLEDGE_CHUNK_MAX_PIECES`） |
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
| [knowledge-assistant-outline-toc-prepend.md](./knowledge-assistant-outline-toc-prepend.md) | 「生成目录」文首写入 / 补 `## 目录`（三分支） |
| [knowledge-assistant-stream-ux.md](./knowledge-assistant-stream-ux.md) | 流式：隐藏思考链、Spinner 动画 |
| [knowledge-assistant-layout-scrollbar-alignment.md](./knowledge-assistant-layout-scrollbar-alignment.md) | 滚动条对齐 |
| [assistant-stream-end-scroll-pin.md](./assistant-stream-end-scroll-pin.md) | **流式结束后误滚底**（idleFlushKey / userPinnedAway / 条带 flush） |
| [knowledge-editor-send-selection-to-assistant-dedupe.md](./knowledge-editor-send-selection-to-assistant-dedupe.md) | 选中发送到助手去重 |
| [assistant-insert-focus.md](./assistant-insert-focus.md) | 复制到助手后自动聚焦输入框（右键 + 快捷键） |
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
| [knowledge-save-format-before-persist.md](./knowledge-save-format-before-persist.md) | 保存 / 自动保存前先格式化再落库 |
| [knowledge-save-body-limit.md](./knowledge-save-body-limit.md) | 云端保存请求体上限与 DTO 对齐（修复 PayloadTooLargeError） |
| [knowledge-editor-long-text-perf.md](./knowledge-editor-long-text-perf.md) | **长文编辑性能**：纯 edit 停喂隐藏预览、Store 派生 boolean、助手输入内化 |
| [knowledge-preview-assistant-perf.md](./knowledge-preview-assistant-perf.md) | **预览+助手同开**：SSE rAF 合并、消息列隔离、busy latch、预览加载态 |
| [knowledge-preview-scroll-jank.md](./knowledge-preview-scroll-jank.md) | **长预览滚动卡顿**：FAB 去重、岛屿 HTML memo、toolbar enabled、流式贴底 rAF 合并；步骤手册见 [../ideas/knowledge-scroll-jank-fix-steps.md](../ideas/knowledge-scroll-jank-fix-steps.md) |
| [knowledge-preview-code-toolbar-scroll.md](./knowledge-preview-code-toolbar-scroll.md) | **长文多代码块预览滚动**：吸顶栏块列表缓存、二分定位、O(1) 清 pinned；影响点见 [../impact/knowledge-preview-code-toolbar-scroll.md](../impact/knowledge-preview-code-toolbar-scroll.md) |
| [shortcuts.md](./shortcuts.md) |
| [unauthenticated-local-only.md](./unauthenticated-local-only.md) |

---

## 相关（包外）

- Markdown / Mermaid 工具包：[../tools/index.md](../tools/index.md)
- Monaco 预览：[../monaco/](../monaco/)
- Mermaid UI：[../mermaid/](../mermaid/)

上级索引：[../README.md](../README.md)
