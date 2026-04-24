// 引入 Node.js 加密模块：用于 sha256 与生成 UUID
import { createHash, randomUUID } from 'node:crypto';
// 引入 NestJS（服务端框架）DI 与日志类型
import { Inject, Injectable, type LoggerService } from '@nestjs/common';
// 引入 NestJS 配置服务
import { ConfigService } from '@nestjs/config';
// 引入 Winston 注入 token
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
// 引入本项目配置枚举
import { KnowledgeQaEnum, ModelEnum } from '../../enum/config.enum';
// 引入 Qdrant 服务与 payload 类型
import {
	type QdrantKnowledgePayload,
	QdrantService,
} from '../qdrant/qdrant.service';

// 知识库切分后的分片结构
export type KnowledgeChunk = {
	// 分片序号
	chunkIndex: number;
	// 分片文本
	text: string;
};

// 计算 sha256：用于内容幂等标识
function sha256(text: string): string {
	// 创建哈希器
	const h = createHash('sha256');
	// 写入内容
	h.update(text);
	// 输出 hex 字符串
	return h.digest('hex');
}

/**
 * 知识库 embedding 与 Qdrant 入库服务（一期：同步实现；后续可接 BullMQ 任务化）。
 */
@Injectable()
export class KnowledgeEmbeddingService {
	// 构造函数：注入 Config/Qdrant/Logger
	constructor(
		// 配置服务
		private readonly config: ConfigService,
		// 向量库服务
		private readonly qdrant: QdrantService,
		// 注入 Winston logger
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		// logger 实例
		private readonly logger: LoggerService,
	) {}

	// 创建 embedding 客户端：封装 DashScope 调用、重试与解析
	private createEmbeddingsClient(): {
		// 单条 query 向量
		embedQuery: (text: string) => Promise<number[]>;
		// 批量 document 向量
		embedDocuments: (texts: string[]) => Promise<number[][]>;
	} {
		// 读取 API Key：优先 DASHSCOPE_API_KEY
		const apiKey =
			this.config.get<string>(KnowledgeQaEnum.DASHSCOPE_API_KEY) ||
			this.config.get<string>(ModelEnum.QWEN_API_KEY) ||
			'';
		// 读取 baseURL：用于推导 origin
		const baseURL =
			this.config.get<string>(ModelEnum.QWEN_BASE_URL) || undefined;
		// 校验 API Key
		if (!apiKey) {
			throw new Error(
				'缺少 DASHSCOPE_API_KEY（或 QWEN_API_KEY），无法进行知识库向量入库',
			);
		}
		// 读取模型名
		const model =
			this.config.get<string>(KnowledgeQaEnum.KNOWLEDGE_EMBEDDING_MODEL) ||
			'qwen3-vl-embedding';

		// 计算 origin
		const origin = (() => {
			if (!baseURL) return 'https://dashscope.aliyuncs.com';
			try {
				const u = new URL(baseURL);
				if (
					u.hostname.endsWith('dashscope.aliyuncs.com') ||
					u.hostname.endsWith('dashscope-intl.aliyuncs.com')
				) {
					u.protocol = 'https:';
				}
				return u.origin;
			} catch {
				return baseURL;
			}
		})();

		// 拼接 endpoint
		const endpoint = `${origin}/api/v1/services/embeddings/multimodal-embedding/multimodal-embedding`;

		// 单次请求：对一批 texts 做向量化
		const callOnce = async (texts: string[]): Promise<number[][]> => {
			const maxAttempts = 3;
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 60_000);
				try {
					let resp: Response;
					try {
						resp = await fetch(endpoint, {
							method: 'POST',
							headers: {
								Authorization: `Bearer ${apiKey}`,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								model,
								input: { contents: texts.map((t) => ({ text: t })) },
							}),
							signal: controller.signal,
						});
					} catch (err: unknown) {
						const e = err as any;
						const causeMsg =
							e?.cause instanceof Error
								? e.cause.message
								: e?.cause
									? String(e.cause)
									: '';
						const msg = `DashScope 向量请求网络错误：${e?.message || String(err)}${causeMsg ? `（cause: ${causeMsg}）` : ''}；endpoint=${endpoint}；attempt=${attempt}/${maxAttempts}`;
						if (attempt === maxAttempts) throw new Error(msg);
						await new Promise((r) => setTimeout(r, 300 * attempt));
						continue;
					}

					let rawText = '';
					try {
						rawText = await resp.text();
					} catch (err: unknown) {
						const e = err as any;
						const causeMsg =
							e?.cause instanceof Error
								? e.cause.message
								: e?.cause
									? String(e.cause)
									: '';
						throw new Error(
							`DashScope 读取响应失败：${e?.message || String(err)}${causeMsg ? `（cause: ${causeMsg}）` : ''}；endpoint=${endpoint}`,
						);
					}

					let json: any = null;
					try {
						json = rawText ? JSON.parse(rawText) : null;
					} catch {
						// ignore
					}

					if (!resp.ok) {
						const msg =
							json?.message ||
							json?.error?.message ||
							rawText ||
							`HTTP ${resp.status}`;
						throw new Error(
							`DashScope 向量请求失败：${msg}；status=${resp.status}；endpoint=${endpoint}`,
						);
					}

					const embeddings =
						json?.output?.embeddings ??
						json?.output?.data ??
						json?.data ??
						json?.embeddings;
					if (!Array.isArray(embeddings) || embeddings.length === 0) {
						throw new Error(
							`DashScope 返回结构不包含 embeddings：${JSON.stringify(
								Object.keys(json || {}),
							)}；endpoint=${endpoint}`,
						);
					}

					const vectors = embeddings.map((e: any) => {
						const v =
							e?.embedding ??
							e?.vector ??
							e?.output?.embedding ??
							e?.output?.vector ??
							e?.embeddings ??
							null;
						if (Array.isArray(v)) return v;
						if (Array.isArray(v?.dense)) return v.dense;
						return null;
					});
					if (vectors.some((v: any) => !Array.isArray(v))) {
						throw new Error(
							`DashScope 返回的 embedding 向量解析失败；endpoint=${endpoint}`,
						);
					}
					return vectors as number[][];
				} finally {
					clearTimeout(timeout);
				}
			}
			throw new Error('DashScope 向量请求失败：未知错误');
		};

		// 分批调用：避免 batch size 限制
		const callBatched = async (texts: string[]): Promise<number[][]> => {
			const out: number[][] = [];
			const batchSize = 10;
			for (let i = 0; i < texts.length; i += batchSize) {
				const batch = texts.slice(i, i + batchSize);
				const vecs = await callOnce(batch);
				out.push(...vecs);
			}
			return out;
		};

		return {
			embedQuery: async (text: string) => {
				const [v] = await callBatched([text]);
				return v ?? [];
			},
			embedDocuments: async (texts: string[]) => callBatched(texts),
		};
	}

	// 对外暴露：生成单条 query 向量（供 QA 等模块复用）
	async embedQuery(text: string): Promise<number[]> {
		return this.createEmbeddingsClient().embedQuery(text);
	}

	// 对外暴露：批量生成 document 向量（供入库等流程复用）
	async embedDocuments(texts: string[]): Promise<number[][]> {
		return this.createEmbeddingsClient().embedDocuments(texts);
	}

	// 对外暴露：删除某篇知识库文档在向量库中的全部 points（供回收站物理删除等场景使用）
	async deleteKnowledgeVectors(input: { knowledgeId: string }): Promise<void> {
		await this.qdrant.deleteKnowledgePointsByKnowledgeId(input.knowledgeId);
	}

	// Markdown 切分：标题优先、长度兜底、带 overlap
	chunkMarkdown(input: { title: string; content: string }): KnowledgeChunk[] {
		const raw = `${input.title?.trim() || ''}\n\n${input.content ?? ''}`.trim();
		if (!raw) return [];

		const target = 1000;
		const overlap = 160;
		const lines = raw.split(/\r?\n/);

		const blocks: string[] = [];
		let buf: string[] = [];
		for (const line of lines) {
			const isHeading = /^#{1,6}\s+/.test(line);
			if (isHeading && buf.length > 0) {
				blocks.push(buf.join('\n').trim());
				buf = [];
			}
			buf.push(line);
		}
		if (buf.length) blocks.push(buf.join('\n').trim());

		const chunks: string[] = [];
		for (const b of blocks) {
			if (b.length <= target) {
				chunks.push(b);
				continue;
			}
			let i = 0;
			while (i < b.length) {
				const end = Math.min(b.length, i + target);
				const piece = b.slice(i, end).trim();
				if (piece) chunks.push(piece);
				i = end - overlap;
				if (i < 0) i = 0;
				if (end === b.length) break;
			}
		}

		return chunks.map((text, idx) => ({ chunkIndex: idx, text }));
	}

	// 入库：将一篇知识库文档写入向量库
	async indexKnowledge(input: {
		knowledgeId: string;
		authorId: number | null;
		title: string | null;
		content: string;
		createdAt: Date;
		updatedAt: Date;
	}): Promise<{ contentHash: string; chunkCount: number }> {
		const title = (input.title ?? '').trim() || '未命名';
		const contentHash = sha256(`${title}\n\n${input.content ?? ''}`);
		const chunks = this.chunkMarkdown({ title, content: input.content ?? '' });
		if (chunks.length === 0) {
			await this.deleteKnowledgeVectors({ knowledgeId: input.knowledgeId });
			return { contentHash, chunkCount: 0 };
		}

		const vectors = await this.embedDocuments(chunks.map((c) => c.text));
		const vectorSize = vectors[0]?.length ?? 0;
		if (vectorSize <= 0) {
			throw new Error('embedding 向量维度为 0');
		}

		/**
		 * 为什么这里选择“先删除，再写入（delete + upsert）”？
		 *
		 * - **分片不稳定**：文档更新后，chunk 的数量/边界/顺序（chunkIndex）可能整体变化，想做“原地更新对应点”需要一套稳定的 point id 映射策略；
		 *   但当前实现每个 chunk 的点 ID 使用 `randomUUID()`，天然不支持按同一批点 ID 做增量更新。
		 * - **一致性更简单**：delete + upsert 等价于“用最新版本完整覆盖”，可以避免旧分片残留导致检索命中已删除内容。
		 * - **Qdrant upsert 的语义**：Qdrant 的 upsert 是按 **point id** 更新/插入，而不是按 payload（如 knowledgeId）更新；
		 *   若要按 knowledgeId 做增量更新，需要额外先查询旧点 id 列表并维护差异，复杂度显著增加。
		 *
		 * 对于知识库入库这种“写入频率低、查询频率高”的场景，优先选择正确性与实现简单性。
		 */
		await this.qdrant.ensureKnowledgeCollection({ vectorSize });
		await this.deleteKnowledgeVectors({ knowledgeId: input.knowledgeId });

		const createdAt = input.createdAt.toISOString();
		const updatedAt = input.updatedAt.toISOString();

		const points = chunks.map((c, i) => {
			const payload: QdrantKnowledgePayload = {
				knowledgeId: input.knowledgeId,
				authorId: input.authorId ?? null,
				title,
				chunkIndex: c.chunkIndex,
				text: c.text,
				contentHash,
				createdAt,
				updatedAt,
			};
			return { id: randomUUID(), vector: vectors[i]!, payload };
		});

		await this.qdrant.upsertKnowledgeChunks({ points });
		return { contentHash, chunkCount: points.length };
	}

	// 安全入库：捕获异常并记录日志，不影响主流程
	async safeIndexKnowledge(
		input: Parameters<KnowledgeEmbeddingService['indexKnowledge']>[0],
	) {
		try {
			return await this.indexKnowledge(input);
		} catch (err) {
			const e = err as any;
			const causeMsg =
				e?.cause instanceof Error
					? e.cause.message
					: e?.cause
						? String(e.cause)
						: '';
			const stack = e?.stack ? String(e.stack) : '';
			this.logger.error(
				`[KnowledgeEmbeddingService] indexKnowledge failed: knowledgeId=${input.knowledgeId} err=${err instanceof Error ? err.message : String(err)}${causeMsg ? ` cause=${causeMsg}` : ''}${stack ? ` stack=${stack}` : ''}`,
			);
			return null;
		}
	}
}
