# 五、知识库与 RAG

## 5.1 系统架构

### 5.1.1 模块划分

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| **knowledge** | 知识条目增删改查、回收站、助手会话关联清理 | `knowledge.controller.ts`、`knowledge.service.ts` |
| **knowledge-embedding** | Markdown 切分（chunk）、DashScope embedding 生成、覆盖式入库 | `knowledge-embedding.service.ts` |
| **qdrant** | Qdrant SDK 封装：collection 管理、upsert、search、delete | `qdrant.service.ts` |
| **knowledge-qa** | 检索问答 SSE、事件模型、GLM 流式解析 | `knowledge-qa.controller.ts`、`knowledge-qa.service.ts` |
| **assistant** | 助手对话/会话管理、ephemeral 模式 | `assistant.controller.ts`、`assistant.service.ts` |

### 5.1.2 架构图

```
用户保存知识 → KnowledgeService.saveMarkdown
    │
    └─ 异步 safeIndexKnowledge（不阻塞主流程）
        │
        ├─ chunkMarkdown           # 按 Markdown 标题切分
        │   ├─ target: 1000 字符
        │   └─ overlap: 160 字符
        │
        ├─ embedDocuments           # DashScope embedding
        │   ├─ batchSize: 10
        │   ├─ 重试 3 次
        │   └─ 超时 60s
        │
        ├─ ensureKnowledgeCollection  # 幂等建表（Cosine 距离）
        │
        ├─ deleteKnowledgePointsByKnowledgeId  # 覆盖式删除
        │
        └─ upsertKnowledgeChunks     # 批量写入向量

用户提问 → knowledge-qa.controller.ts
    │
    ├─ embedQuery                    # 查询向量化
    ├─ Qdrant.search(topK=6)         # 向量检索
    ├─ 可选 rerank                   # DashScope qwen3-rerank
    ├─ 拼接上下文（最多 12 条证据）
    ├─ 拼接 system 提示词（强约束）
    └─ ChatOpenAI.stream()           # 流式输出
        └─ qa.delta SSE 事件
```

---

## 5.2 Markdown 切分

### 5.2.1 切分策略

```typescript
// knowledge-embedding.service.ts
function chunkMarkdown(markdown: string, targetSize = 1000, overlap = 160): string[] {
  const chunks: string[] = [];

  // 按 Markdown 标题切分
  const sections = markdown.split(/^(#{1,4}\s+.+)$/gm);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section.trim()) continue;

    // 短 section 直接作为一个 chunk
    if (section.length <= targetSize) {
      chunks.push(section);
      continue;
    }

    // 超长 section 滑窗切分
    const sentences = section.split(/(?<=[。！？.!?])/);
    let window = '';

    for (const sentence of sentences) {
      if (window.length + sentence.length > targetSize && window) {
        chunks.push(window.trim());
        window = sentence;
      } else {
        window += sentence;
      }
    }
    if (window.trim()) chunks.push(window.trim());
  }

  return chunks.filter(c => c.length > 100);  // 过滤过短 chunk
}
```

---

## 5.3 向量化

### 5.3.1 Embedding 生成

```typescript
// knowledge-embedding.service.ts
async embedDocuments(chunks: string[]): Promise<number[][]> {
  const vectors: number[][] = [];
  const batchSize = 10;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(
          'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-embedding/generation',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.configService.get('DASHSCOPE_API_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: this.configService.get('KNOWLEDGE_EMBEDDING_MODEL') || 'qwen3-vl-embedding',
              input: batch,
              parameters: { dimension: 1024 },
            }),
          },
        );

        if (!response.ok) throw new Error(`Embedding failed: ${response.status}`);
        const data = await response.json();

        vectors.push(...(data.output.embeddings.map((e: any) => e.embedding)));
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }

  return vectors;
}
```

### 5.3.2 覆盖式入库

```typescript
async safeIndexKnowledge(knowledgeId: string, markdown: string) {
  // 获取知识条目元数据
  const knowledge = await this.knowledgeService.findOne(knowledgeId);

  // 切分
  const chunks = chunkMarkdown(markdown);
  if (!chunks.length) return;

  // 向量化
  const vectors = await this.embedDocuments(chunks);

  // 确保 collection 存在
  await this.qdrantService.ensureKnowledgeCollection();

  // 覆盖式删除旧向量
  await this.qdrantService.deleteKnowledgePointsByKnowledgeId(knowledgeId);

  // 批量 upsert
  const points = chunks.map((chunk, i) => ({
    id: `${knowledgeId}-${i}`,
    vector: vectors[i],
    payload: {
      knowledge_id: knowledgeId,
      content: chunk,
      author_id: knowledge.authorId,
      updated_at: new Date().toISOString(),
    },
  }));

  await this.qdrantService.upsertKnowledgeChunks(points);
}
```

---

## 5.4 Qdrant 封装

### 5.4.1 Collection 管理

```typescript
// qdrant.service.ts
@Injectable()
export class QdrantService {
  private client: QdrantClient;
  private collectionName: string;

  constructor(configService: ConfigService) {
    this.client = new QdrantClient({
      url: configService.get('QDRANT_URL') || 'http://localhost:6333',
    });
    this.collectionName = configService.get('QDRANT_KNOWLEDGE_COLLECTION')
      || 'knowledge_chunks_v1';
  }

  async ensureKnowledgeCollection() {
    const exists = await this.client.collectionExists(this.collectionName);
    if (!exists) {
      await this.client.createCollection(this.collectionName, {
        vectors: { size: 1024, distance: 'Cosine' },
      });
    }
  }

  async upsertKnowledgeChunks(points: Point[]) {
    await this.client.upsert(this.collectionName, {
      wait: true,
      points,
    });
  }

  async searchKnowledgeChunks(
    vector: number[],
    authorId: string,
    limit = 6,
  ): Promise<SearchHit[]> {
    return this.client.search(this.collectionName, {
      vector,
      filter: {
        must: [{ key: 'author_id', match: { value: authorId } }],
      },
      limit,
      score_threshold: 0.5,
    });
  }

  async deleteKnowledgePointsByKnowledgeId(knowledgeId: string) {
    await this.client.delete(this.collectionName, {
      points: null,
      filter: {
        must: [{ key: 'knowledge_id', match: { value: knowledgeId } }],
      },
    });
  }
}
```

---

## 5.5 RAG 问答

### 5.5.1 检索增强流程

```typescript
// knowledge-qa.service.ts
async *qaStream(dto: KnowledgeQaDto) {
  const { question, knowledgeIds } = dto;

  // 1. 问题向量化
  const queryVector = await this.embeddingService.embedQuery(question);

  // 2. 向量检索
  const searchResults = await this.qdrantService.searchKnowledgeChunks(
    queryVector, dto.userId, 8,
  );

  // 3. Rerank 二次重排（可选）
  let rerankedResults = searchResults;
  if (dto.enableRerank) {
    rerankedResults = await this.rerankService.rerank(question, searchResults);
  }

  // 4. 拼接上下文
  const evidences = rerankedResults.slice(0, 6);
  const contextText = evidences
    .map((e, i) => `[证据${i + 1}]: ${e.payload.content}`)
    .join('\n\n');

  // 5. 构建 system 提示词（强约束）
  const systemPrompt = `你是一个基于知识库的问答助手。请严格根据以下证据回答用户问题。
要求：
- 只基于提供的证据回答，不要编造信息
- 如果证据不足，明确说明"根据现有资料无法回答"
- 引用证据时标注编号，如 [证据1]
- 回答要简洁、准确

证据：
${contextText}`;

  // 6. LLM 流式调用
  const llm = createLlm({ preset: 'knowledgeQa' });
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ];

  yield { type: 'qa.start', data: null };
  yield { type: 'qa.retrieval', data: evidences };

  const stream = await llm.stream(messages);
  for await (const chunk of stream) {
    yield { type: 'qa.delta', data: chunk.content };
  }

  yield { type: 'qa.done', data: { evidences, content: stream.getFullContent() } };
}
```

### 5.5.2 SSE 事件协议

| type | 说明 | payload |
|------|------|---------|
| `qa.start` | 开始 | null |
| `qa.retrieval` | 检索证据（可选） | `evidences[]` |
| `qa.delta` | 模型增量文本 | `{ content: string }` |
| `qa.done` | 完成 | `{ content, evidences }` |
| `qa.error` | 错误 | `{ message: string }` |

---

## 5.6 知识库助手

### 5.6.1 多会话管理

```typescript
// assistant.service.ts
@Injectable()
export class AssistantService {
  private sessionMap = new Map<string, AssistantSession>();

  async createSession(userId: string, knowledgeId?: string): Promise<string> {
    const sessionId = uuidv4();
    const session = this.sessionRepo.create({
      id: sessionId, userId, knowledgeId,
      history: [], lastActiveAt: new Date(),
    });
    await this.sessionRepo.save(session);
    return sessionId;
  }

  async streamAssistant(
    sessionId: string,
    message: string,
    options: { ephemeral?: boolean; contextTurns?: number },
  ) {
    const session = await this.sessionRepo.findOne(sessionId);
    const history = options.ephemeral
      ? []  // ephemeral 模式不查历史
      : await this.getMessageHistory(sessionId);

    // 截断历史
    const truncatedHistory = history.slice(-options.contextTurns!);

    const stream = await this.llmService.streamConversation([
      ...truncatedHistory,
      { role: 'user', content: message },
    ]);

    return stream;
  }

  async importTranscript(
    sessionId: string,
    messages: Message[],
  ): Promise<void> {
    // 将内存消息迁入云端
    const session = await this.sessionRepo.findOne(sessionId);
    session.history.push(...messages);
    await this.sessionRepo.save(session);
  }
}
```

### 5.6.2 Ephemeral 模式

```typescript
// 前端调用（不落库草稿）
async function sendEphemeralMessage(content: string) {
  const streamId = `ephemeral-${Date.now()}`;

  await sseClient.streamAssistantSse({
    ephemeral: true,
    contextTurns: 5,
    streamId,
    messages: [{ role: 'user', content }],
  });
}
```

---

## 5.7 API 设计

| 路由 | 方法 | 说明 |
|------|------|------|
| `/knowledge/save` | POST | 保存知识（触发异步入库） |
| `/knowledge/update/:id` | PUT | 更新知识 |
| `/knowledge/list` | GET | 知识列表（分页） |
| `/knowledge/detail/:id` | GET | 知识详情 |
| `/knowledge/delete/:id` | DELETE | 删除知识 |
| `/knowledge/trash` | GET | 回收站列表 |
| `/knowledge/trash/:id` | POST | 恢复 |
| `/knowledge/trash/:id` | DELETE | 永久删除 |
| `/knowledge/qa/ask` | POST + SSE | RAG 问答 |
| `/assistant/sse` | POST + SSE | 知识库助手问答 |
| `/assistant/session` | POST | 创建助手会话 |
| `/assistant/session/:id` | GET | 获取会话详情 |
| `/assistant/session/import-transcript` | POST | 草稿迁入云端 |
| `/assistant/session/for-knowledge/:id` | GET | 按知识条目查会话 |
| `/assistant/stop` | POST | 停止助手流 |

---

## 5.8 配置要点

| 配置 | 说明 |
|------|------|
| `QDRANT_URL` | Qdrant 地址（默认 `http://localhost:6333`） |
| `QDRANT_KNOWLEDGE_COLLECTION` | Collection 名（默认 `knowledge_chunks_v1`） |
| `DASHSCOPE_API_KEY` | DashScope embedding 必配 |
| `KNOWLEDGE_EMBEDDING_MODEL` | 向量模型（默认 `qwen3-vl-embedding`） |
| `ZHIPU_API_KEY` | 智谱问答模型必配 |
| `ZHIPU_BASE_URL` | 智谱 Base URL |
| `KNOWLEDGE_ENABLE_RERANK` | 是否启用 Rerank |

---

## 5.9 知识库数据模型

```typescript
// knowledge.entity.ts
@Entity('knowledges')
export class Knowledge {
  @PrimaryGeneratedUUID()
  id: string;

  @Column()
  title: string;

  @Column('text', { nullable: true })
  content?: string;

  @Column({ nullable: true })
  coverImage?: string;

  @Column({ type: 'enum', enum: ['cloud', 'local'], default: 'cloud' })
  mode: 'cloud' | 'local';

  @Column({ nullable: true })
  localPath?: string;

  @Column()
  authorId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// assistant-session.entity.ts
@Entity('assistant_sessions')
export class AssistantSession {
  @PrimaryGeneratedUUID()
  id: string;

  @Column()
  userId: string;

  @Column({ nullable: true })
  knowledgeId?: string;

  @Column('json', { default: [] })
  history: AssistantMessage[];

  @Column({ type: 'datetime', nullable: true })
  lastActiveAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
```
