// 引入 Node.js 加密模块：用于 sha256 与生成 UUID
import { createHash, randomUUID } from 'node:crypto';
// 引入 NestJS（服务端框架）DI 与日志类型
import { Inject, Injectable, type LoggerService } from '@nestjs/common';
// 引入 NestJS 配置服务
import { ConfigService } from '@nestjs/config';
// 引入 Winston 注入 token
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
// 引入本项目配置枚举
import {
	KNOWLEDGE_EMBEDDING_BATCH_SIZE,
	type KnowledgeVectorApiConfig,
	type KnowledgeVectorTier,
	resolveKnowledgeEmbeddingApiConfig,
	resolveKnowledgeRerankApiConfig,
} from '../../utils/create-llm';
// 引入 Qdrant 服务与 payload 类型
import {
	type QdrantKnowledgePayload,
	QdrantService,
} from '../qdrant/qdrant.service';
import { UserService } from '../user/user.service';

// 知识库切分后的分片结构
export type KnowledgeChunk = {
	// 分片序号
	chunkIndex: number;
	// 分片文本
	text: string;
};

// 重排（rerank）结果：文档在原 documents 数组中的下标与相关性分数
export type KnowledgeRerankResult = {
	// 原文档数组下标
	index: number;
	// 相关性分数（越大通常越相关）
	score: number;
};

/** 两 embedding 向量的余弦相似度（模块内用于向量比对） */
function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		const x = a[i] ?? 0;
		const y = b[i] ?? 0;
		dot += x * y;
		na += x * x;
		nb += y * y;
	}
	const denom = Math.sqrt(na) * Math.sqrt(nb);
	return denom === 0 ? 0 : dot / denom;
}

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
 *
 * 向量与重排：凭证由 `create-llm` 解析；非会员 bge 1024 库，有效会员 Qwen3 2560 库 + 双路检索旧库。
 */
@Injectable()
export class KnowledgeEmbeddingService {
	// 构造函数：注入 Config/Qdrant/Logger
	constructor(
		private readonly config: ConfigService,
		private readonly qdrant: QdrantService,
		private readonly userService: UserService,
		@Inject(WINSTON_MODULE_NEST_PROVIDER)
		private readonly logger: LoggerService,
	) {}

	private async resolveTierForAuthor(
		authorId?: number | null,
	): Promise<KnowledgeVectorTier> {
		if (authorId == null || !Number.isFinite(authorId) || authorId <= 0) {
			return 'default';
		}
		return (await this.userService.isUserMembershipActive(authorId))
			? 'member'
			: 'default';
	}

	private mergeSearchHits(
		batches: Array<
			Array<{
				score: number;
				payload: QdrantKnowledgePayload;
				id: string | number;
			}>
		>,
		topK: number,
	): Array<{
		score: number;
		payload: QdrantKnowledgePayload;
		id: string | number;
	}> {
		const byKey = new Map<
			string,
			{
				score: number;
				payload: QdrantKnowledgePayload;
				id: string | number;
			}
		>();
		for (const hits of batches) {
			for (const h of hits) {
				const key = `${h.payload.knowledgeId}:${h.payload.chunkIndex}`;
				const prev = byKey.get(key);
				if (!prev || h.score > prev.score) {
					byKey.set(key, h);
				}
			}
		}
		return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, topK);
	}

	// 创建 embedding 客户端：请求 URL 为 SILICONFLOW_EMBEDDING_URL 完整地址
	private createEmbeddingsClient(apiConfig: KnowledgeVectorApiConfig): {
		// 单条 query 向量
		embedQuery: (text: string) => Promise<number[]>;
		// 批量 document 向量
		embedDocuments: (texts: string[]) => Promise<number[][]>;
	} {
		const { apiKey, model, baseURL } = apiConfig;

		// 单次请求：对一批 texts 做向量化（OpenAI 兼容：input 可为 string 或 string[]）
		const callOnce = async (texts: string[]): Promise<number[][]> => {
			const sanitized = texts
				.map((t) => String(t ?? '').trim())
				.filter((t) => t.length > 0);
			if (sanitized.length === 0) return [];

			const maxAttempts = 3;
			for (let attempt = 1; attempt <= maxAttempts; attempt++) {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 60_000);
				try {
					let resp: Response;
					try {
						resp = await fetch(baseURL, {
							method: 'POST',
							headers: {
								Authorization: `Bearer ${apiKey}`,
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								model,
								input: sanitized.length === 1 ? sanitized[0] : sanitized,
								encoding_format: 'float',
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
						const msg = `SiliconFlow 向量请求网络错误：${e?.message || String(err)}${causeMsg ? `（cause: ${causeMsg}）` : ''}；url=${baseURL}；attempt=${attempt}/${maxAttempts}`;
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
							`SiliconFlow 读取响应失败：${e?.message || String(err)}${causeMsg ? `（cause: ${causeMsg}）` : ''}；url=${baseURL}`,
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
							`SiliconFlow 向量请求失败：${msg}；status=${resp.status}；url=${baseURL}；model=${model}；batch=${sanitized.length}；maxLen=${Math.max(...sanitized.map((t) => t.length))}`,
						);
					}

					const data = json?.data;
					if (!Array.isArray(data) || data.length === 0) {
						throw new Error(
							`SiliconFlow 返回结构不包含 data[]：${JSON.stringify(
								Object.keys(json || {}),
							)}；url=${baseURL}`,
						);
					}

					const sorted = [...data].sort(
						(a: any, b: any) =>
							(Number(a?.index) || 0) - (Number(b?.index) || 0),
					);
					const vectors = sorted.map((item: any) => {
						const v = item?.embedding;
						return Array.isArray(v) ? v : null;
					});
					if (vectors.some((v: any) => !Array.isArray(v))) {
						throw new Error(
							`SiliconFlow 返回的 embedding 向量解析失败；url=${baseURL}`,
						);
					}
					return vectors as number[][];
				} finally {
					clearTimeout(timeout);
				}
			}
			throw new Error('SiliconFlow 向量请求失败：未知错误');
		};

		// 分批调用：硅基流动单请求 input 数组最多 32 条（见官方文档）
		const callBatched = async (texts: string[]): Promise<number[][]> => {
			const out: number[][] = [];
			for (let i = 0; i < texts.length; i += KNOWLEDGE_EMBEDDING_BATCH_SIZE) {
				const batch = texts.slice(i, i + KNOWLEDGE_EMBEDDING_BATCH_SIZE);
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
	async embedQuery(
		text: string,
		options?: { tier?: KnowledgeVectorTier },
	): Promise<number[]> {
		const tier = options?.tier ?? 'default';
		const apiConfig = resolveKnowledgeEmbeddingApiConfig(this.config, tier);
		return this.createEmbeddingsClient(apiConfig).embedQuery(text);
	}

	// 对外暴露：批量生成 document 向量（供入库等流程复用）
	async embedDocuments(
		texts: string[],
		options?: { tier?: KnowledgeVectorTier },
	): Promise<number[][]> {
		const tier = options?.tier ?? 'default';
		const apiConfig = resolveKnowledgeEmbeddingApiConfig(this.config, tier);
		return this.createEmbeddingsClient(apiConfig).embedDocuments(texts);
	}

	/**
	 * RAG 向量召回：非会员仅搜 bge 库；有效会员同时搜 Qwen3 2560 库与 bge 库（兼容未迁移存量）。
	 */
	async searchKnowledgeChunksForAuthor(input: {
		question: string;
		authorId: number;
		topK: number;
	}): Promise<
		Array<{
			score: number;
			payload: QdrantKnowledgePayload;
			id: string | number;
		}>
	> {
		const tier = await this.resolveTierForAuthor(input.authorId);
		const tiers: KnowledgeVectorTier[] =
			tier === 'member' ? ['member', 'default'] : ['default'];

		const batches = await Promise.all(
			tiers.map(async (t) => {
				const qvec = await this.embedQuery(input.question, { tier: t });
				if (!qvec.length) return [];
				const collectionName = this.qdrant.getKnowledgeCollectionName(t);
				try {
					return await this.qdrant.searchKnowledgeChunks({
						vector: qvec,
						topK: input.topK,
						authorId: input.authorId,
						collectionName,
					});
				} catch {
					return [];
				}
			}),
		);

		return this.mergeSearchHits(batches, input.topK);
	}

	/**
	 * 用项目配置的 embedding 模型向量化 query 与候选短文本，按余弦相似度筛选相关项。
	 * @returns 达到阈值的候选在 `candidates` 中的下标（空串候选跳过）
	 */
	async findCandidateIndicesSimilarToQuery(input: {
		query: string;
		candidates: string[];
		minCosineSimilarity?: number;
	}): Promise<number[]> {
		const query = (input.query ?? '').trim();
		const minSim =
			typeof input.minCosineSimilarity === 'number' &&
			Number.isFinite(input.minCosineSimilarity)
				? input.minCosineSimilarity
				: 0.72;
		const candidates = (input.candidates ?? []).map((c) =>
			String(c ?? '').trim(),
		);
		if (!query || candidates.length === 0) return [];

		const indexed: { index: number; text: string }[] = [];
		for (let i = 0; i < candidates.length; i++) {
			const text = candidates[i]!;
			if (text) indexed.push({ index: i, text });
		}
		if (indexed.length === 0) return [];

		const vectors = await this.embedDocuments([
			query,
			...indexed.map((x) => x.text),
		]);
		const queryVec = vectors[0];
		if (!queryVec?.length) return [];

		const matched: number[] = [];
		for (let j = 0; j < indexed.length; j++) {
			const vec = vectors[j + 1];
			if (vec?.length && cosineSimilarity(queryVec, vec) >= minSim) {
				matched.push(indexed[j]!.index);
			}
		}
		return matched;
	}

	// 对外暴露：删除某篇知识库文档在向量库中的全部 points（供回收站物理删除等场景使用）
	async deleteKnowledgeVectors(input: { knowledgeId: string }): Promise<void> {
		await this.qdrant.deleteKnowledgePointsByKnowledgeId(input.knowledgeId);
	}

	/**
	 * 对外暴露：对候选文档进行重排（rerank）
	 *
	 * - 适用场景：Qdrant（向量召回）拿到 topK 后，用 rerank 模型做二次排序，提升最终相关性。
	 * - 输入：query（问题），documents（候选文本），topN（返回前 N 条）
	 * - 输出：按相关性从高到低排序的结果（包含原下标 index）
	 */
	async rerank(input: {
		query: string;
		documents: string[];
		topN?: number;
		authorId?: number;
	}): Promise<KnowledgeRerankResult[]> {
		const tier = await this.resolveTierForAuthor(input.authorId);
		const { apiKey, model, baseURL } = resolveKnowledgeRerankApiConfig(
			this.config,
			tier,
		);

		const query = (input.query ?? '').trim();
		const documents = (input.documents ?? []).map((d) => String(d ?? ''));
		if (!query) return [];
		if (documents.length === 0) return [];

		const topN = Math.max(
			1,
			Math.min(
				Number.isFinite(input.topN as number)
					? Number(input.topN)
					: documents.length,
				documents.length,
			),
		);

		const maxAttempts = 3;
		for (let attempt = 1; attempt <= maxAttempts; attempt++) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 60_000);
			try {
				let resp: Response;
				try {
					resp = await fetch(baseURL, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${apiKey}`,
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							model,
							query,
							documents,
							top_n: topN,
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
					const msg = `SiliconFlow rerank 请求网络错误：${e?.message || String(err)}${causeMsg ? `（cause: ${causeMsg}）` : ''}；url=${baseURL}；attempt=${attempt}/${maxAttempts}`;
					if (attempt === maxAttempts) throw new Error(msg);
					await new Promise((r) => setTimeout(r, 300 * attempt));
					continue;
				}

				const rawText = await resp.text().catch(() => '');
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
						`SiliconFlow rerank 请求失败：${msg}；status=${resp.status}；url=${baseURL}`,
					);
				}

				const results =
					json?.results ??
					json?.output?.results ??
					json?.output?.data ??
					json?.data;
				if (!Array.isArray(results)) {
					throw new Error(
						`SiliconFlow rerank 返回结构不包含 results：${JSON.stringify(
							Object.keys(json || {}),
						)}；url=${baseURL}`,
					);
				}

				const mapped = results
					.map((r: any) => {
						const index = Number(r?.index ?? r?.document_index ?? r?.doc_index);
						const score = Number(
							r?.relevance_score ??
								r?.score ??
								r?.relevance ??
								r?.ranking_score,
						);
						if (!Number.isFinite(index) || !Number.isFinite(score)) return null;
						return { index, score } satisfies KnowledgeRerankResult;
					})
					.filter(Boolean) as KnowledgeRerankResult[];

				// 若服务端未保证排序，这里再按 score 兜底排序
				mapped.sort((a, b) => b.score - a.score);

				return mapped;
			} finally {
				clearTimeout(timeout);
			}
		}

		throw new Error('SiliconFlow rerank 请求失败：未知错误');
	}

	// Markdown 切分：标题优先、长度兜底、带 overlap（按向量档位控制长度）
	chunkMarkdown(input: {
		title: string;
		content: string;
		tier?: KnowledgeVectorTier;
	}): KnowledgeChunk[] {
		const tier = input.tier ?? 'default';
		const raw = `${input.title?.trim() || ''}\n\n${input.content ?? ''}`.trim();
		if (!raw) return [];

		// bge 系列单条约 512 tokens；Qwen3-Embedding 支持更长上下文
		const target = tier === 'member' ? 2000 : 400;
		const overlap = tier === 'member' ? 128 : 64;
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
		const tier = await this.resolveTierForAuthor(input.authorId);
		const chunks = this.chunkMarkdown({
			title,
			content: input.content ?? '',
			tier,
		});
		if (chunks.length === 0) {
			await this.deleteKnowledgeVectors({ knowledgeId: input.knowledgeId });
			return { contentHash, chunkCount: 0 };
		}

		const vectors = await this.embedDocuments(
			chunks.map((c) => c.text),
			{ tier },
		);
		const vectorSize = vectors[0]?.length ?? 0;
		if (vectorSize <= 0) {
			throw new Error('embedding 向量维度为 0');
		}

		const collectionName = this.qdrant.getKnowledgeCollectionName(tier);

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
		await this.qdrant.ensureKnowledgeCollection({
			vectorSize,
			collectionName,
		});
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

		await this.qdrant.upsertKnowledgeChunks({ points, collectionName });
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
