# 知识库向量与重排：硅基流动（SiliconFlow）接入 SPEC（Vibe Coding 指南）

> 本文档描述 `knowledge-embedding`、`knowledge-qa`、`qdrant` 中与 **Embedding**、**Rerank** 相关的约定，便于在 Cursor / AI 辅助下扩展或排错。  
> 官方 API 参考：[创建嵌入请求](https://docs.siliconflow.cn/cn/api-reference/embeddings/create-embeddings)、[创建重排序请求](https://docs.siliconflow.cn/cn/api-reference/rerank/create-rerank)。

---

## 1. 架构与数据流（必读）

```
知识保存/更新 (KnowledgeService)
    → KnowledgeEmbeddingService.indexKnowledge
        → chunkMarkdown（分片）
        → embedDocuments → POST {SILICONFLOW_BASE_URL}/embeddings
        → QdrantService.ensureKnowledgeCollection(vectorSize) + upsert

知识问答 (KnowledgeQaService.askStream)
    → embedQuery → POST .../embeddings
    → QdrantService.searchKnowledgeChunks
    →（可选）embedding.rerank → POST .../rerank
    → GLM 流式生成
```

- **Qdrant** 只存向量与 payload，**不直接调用** SiliconFlow；向量维度由 **embedding 模型输出长度** 决定。
- **knowledge-qa** 不内嵌 HTTP，一律通过 `KnowledgeEmbeddingService` 复用同一套 SiliconFlow 配置与解析逻辑。

---

## 2. 环境变量与配置键（`KnowledgeQaEnum`）

| 键名                        | 必填       | 默认值 / 说明                                                                |
| --------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `SILICONFLOW_API_KEY`       | 是（生产） | Bearer Token，见 [硅基流动 API Key](https://cloud.siliconflow.cn/account/ak) |
| `SILICONFLOW_BASE_URL`      | 否         | `https://api.siliconflow.cn/v1`（勿尾斜杠，代码内会 trim）                   |
| `KNOWLEDGE_EMBEDDING_MODEL` | 否         | `BAAI/bge-large-zh-v1.5`                                                     |
| `KNOWLEDGE_RERANK_MODEL`    | 否         | `BAAI/bge-reranker-v2-m3`                                                    |

**兼容旧环境（过渡期）**

- 若未配置 `SILICONFLOW_API_KEY`，会依次尝试 `DASHSCOPE_API_KEY`、`QWEN_API_KEY`（仅 key 复用，**请求已改为硅基流动域名**，DashScope 专用 base URL 不再使用）。
- Rerank 模型未配置 `KNOWLEDGE_RERANK_MODEL` 时，可回退读取 `DASHSCOPE_RERANK_MODEL_NAME`。
- 如果配置的向量模型维度与之前的不一致，需要删除旧的 `QDRANT_KNOWLEDGE_COLLECTION`，更改为新的 `QDRANT_KNOWLEDGE_COLLECTION`。

---

## 3. Embedding：`POST /v1/embeddings`

### 3.1 请求（与官方 OpenAI 兼容形态一致）

- **URL**：`{SILICONFLOW_BASE_URL}/embeddings`
- **Headers**：`Authorization: Bearer <SILICONFLOW_API_KEY>`，`Content-Type: application/json`
- **Body（实现约定）**
  - `model`：`KNOWLEDGE_EMBEDDING_MODEL`
  - `input`：单条时为 **string**；批量时为 **string[]**（与官方 curl 一致）
  - `encoding_format`：`"float"`

单条示例（等价于官方文档）：

```json
{
	"model": "BAAI/bge-large-zh-v1.5",
	"input": "Silicon flow embedding online: fast, affordable, and high-quality embedding services. come try it out!",
	"encoding_format": "float"
}
```

### 3.2 响应解析（代码契约）

- 成功时解析 **`data` 数组**（OpenAI 兼容）：每项含 `index`、`embedding: number[]`。
- 实现中会对 `data` 按 **`index` 升序** 排序后再取 `embedding`，保证与请求 `input` 数组顺序一致。
- 错误时读取 `message` / `error.message` 或原始 body，包装为 `SiliconFlow 向量请求失败：...`。

### 3.3 批大小与分片长度

- 官方文档：单次 `input` 为字符串数组时，**最多 32 条**；默认实现 `batchSize = 32`。
- `BAAI/bge-large-zh-v1.5` 对单条输入有 **约 512 tokens** 上限（见官方模型说明）。  
  因此 `KnowledgeEmbeddingService.chunkMarkdown` 将单段目标长度收紧为 **约 450 字 + overlap**，降低超长导致 400 的概率。若你更换为更长上下文的 embedding 模型（如 Qwen3-Embedding 系列），应同步调大 `target` 并回归测试。

### 3.4 向量维度与 Qdrant

- `BAAI/bge-large-zh-v1.5` 输出维度为 **1024**（与模型一致；若官方变更以实际返回向量长度为准）。
- `ensureKnowledgeCollection({ vectorSize })` 仅在 **collection 不存在** 时创建；若历史上用其他维度建过同名 collection，会出现维度不一致。  
  **处理方式**：换一个 `QDRANT_KNOWLEDGE_COLLECTION` 名称，或删除旧 collection 后全量重建索引。

---

## 4. Rerank：`POST /v1/rerank`

### 4.1 请求

- **URL**：`{SILICONFLOW_BASE_URL}/rerank`
- **Headers**：同上
- **Body（实现约定）**
  - `model`：`KNOWLEDGE_RERANK_MODEL`（默认 `BAAI/bge-reranker-v2-m3`）
  - `query`：string
  - `documents`：`string[]`（知识库 QA 侧传入的是「标题 + 分片索引 + 正文」拼好的多条文档）
  - `top_n`：number，实现为 `min(请求 topN, documents.length)`，且至少为 1

> 官方 curl 里 `documents` 可为单字符串；本仓库统一用 **数组**，与「多条候选证据」场景一致。

### 4.2 响应解析

- 优先读取 **`results` 数组**（硅基流动 / OpenAPI 定义）；兼容 `output.results` 等历史嵌套。
- 每条结果映射为 `{ index: number, score: number }`：
  - `index` ← `index` / `document_index` / `doc_index`
  - `score` ← `relevance_score` / `score` / `relevance` / `ranking_score`
- 若服务端未保证顺序，实现内会再按 `score` **降序** 排序。

### 4.3 失败策略（knowledge-qa）

- `rerank` 抛错时 **不中断问答**：记录 error 日志，保留原向量召回顺序。

---

## 5. Vibe Coding 清单（改代码前自检）

1. **只改 HTTP 层时**：同步检查 `embedDocuments` / `embedQuery` / `rerank` 三处是否共用同一 base URL 与 key 解析。
2. **换 embedding 模型**：必须确认 **输出维度**；必要时新建 Qdrant collection 名并全量重索引。
3. **换分片策略**：若单段可能超过目标模型的 **token 上限**，优先调 `chunkMarkdown` 的 `target/overlap`，而不是盲目增大 batch。
4. **错误文案**：对用户/日志区分「SiliconFlow 业务错误」与「Qdrant 连接错误」；401 多为 key 无效，403/429 多为额度或限流。
5. **文档**：大改检索链路时，更新本 SPEC 与 `knowledge-qdrant-rag.md` 中「Embedding/Rerank 提供商」描述，避免文档与实现漂移。

---

## 6. 相关源码路径（快速跳转）

| 模块                    | 路径                                                                           |
| ----------------------- | ------------------------------------------------------------------------------ |
| Embedding + Rerank HTTP | `apps/backend/src/services/knowledge-embedding/knowledge-embedding.service.ts` |
| 配置枚举                | `apps/backend/src/enum/config.enum.ts` → `KnowledgeQaEnum`                     |
| QA 检索与 rerank 调用   | `apps/backend/src/services/knowledge-qa/knowledge-qa.service.ts`               |
| Qdrant 封装             | `apps/backend/src/services/qdrant/qdrant.service.ts`                           |

---

## 7. 与旧版文档的关系

- 总览级 RAG 行为仍以 `apps/backend/specs/knowledge-qdrant-rag.md` 为准；其中若仍出现「DashScope」字样，以 **本 SPEC** 为 Embedding/Rerank 提供商的权威描述。
