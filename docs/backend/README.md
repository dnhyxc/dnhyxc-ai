# 后端专题文档

路径前缀：`apps/backend/`。部署与网关见 [server-deployment.md](./server-deployment.md)、[nginx.md](./nginx.md)。

---

## 对话与 LLM 接入

| 文档 | 说明 |
|------|------|
| **[create-llm.md](./create-llm.md)** | `createLlm` 统一工厂（preset / maxTokens / 排查 400） |
| **[llm-runtime-settings.md](./llm-runtime-settings.md)** | 设置页大模型配置持久化与运行时覆盖 env（主文档） |
| **[agent-create-llm-unify.md](./agent-create-llm-unify.md)** | 英语学习 `AgentService` 改 `createLlm` + `preset: 'chat'` |
| **[siliconflow-chat-unification.md](./siliconflow-chat-unification.md)** | 硅基接入总览 + Assistant SSE |
| [english-learning-backend-implementation.md](./english-learning-backend-implementation.md) | 英语学习后端总览 |
| [english-learning-master-agent-web-search-to-llm.md](./english-learning-master-agent-web-search-to-llm.md) | 英语学习 Agent 与联网 |

---

## 知识库向量与 RAG

| 文档 |
|------|
| [knowledge-qdrant-rag.md](./knowledge-qdrant-rag.md) |
| [knowledge-siliconflow-embedding-rerank.md](./knowledge-siliconflow-embedding-rerank.md) |

---

## 部署

| 文档 | 说明 |
|------|------|
| [server-deployment.md](./server-deployment.md) | 部署总览 |
| [deploy.md](./deploy.md) | 部署步骤 |
| [nginx.md](./nginx.md) | Nginx 与 `/images` 反代 / `alias` |
| [../chat/chat-upload-access-prod.md](../chat/chat-upload-access-prod.md) | 生产附件 `/api/upload/serve` 与路径规范化 |
| **[upload-storage-paths.md](./upload-storage-paths.md)** | **本地上传目录与线上 `UPLOAD_ROOT`（主文档）** |

上级索引：[../README.md](../README.md)
