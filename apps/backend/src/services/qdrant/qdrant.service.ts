// NestJS（服务端框架）提供的可注入（Injectable）装饰器
import { Injectable } from '@nestjs/common';
// NestJS 配置服务：读取环境变量/配置文件
import { ConfigService } from '@nestjs/config';
// Qdrant（向量数据库）官方 REST SDK 客户端
import { QdrantClient } from '@qdrant/js-client-rest';
// 本项目配置枚举：包含 QDRANT_* 环境变量键名
import { QdrantEnum } from '../../enum/config.enum';
import type { KnowledgeVectorTier } from '../../utils/create-llm';

// 写入 Qdrant 的 payload（载荷）：随向量一起存储的业务字段
export type QdrantKnowledgePayload = {
	// 知识库文档 ID：用于“按文档删除/回溯来源”
	knowledgeId: string;
	// 作者 ID：用于多用户隔离过滤；null 表示不做作者过滤
	authorId: number | null;
	// 文档标题：用于证据展示/引用
	title: string;
	// 分片序号：用于定位命中片段位置
	chunkIndex: number;
	// 分片文本：用于拼接 RAG（检索增强生成）上下文
	text: string;
	// 内容 hash：用于幂等/审计（判断是否需要重新入库）
	contentHash: string;
	// 创建时间：ISO 字符串，便于跨语言序列化
	createdAt: string;
	// 更新时间：ISO 字符串，便于跨语言序列化
	updatedAt: string;
};

// 声明可注入服务：让 NestJS 能通过 DI（依赖注入）创建并管理该类实例
@Injectable()
// Qdrant 访问层：封装 collection 名、建表、写入、检索等操作
export class QdrantService {
	// 构造函数：由 NestJS DI（依赖注入）自动注入依赖
	constructor(
		// QdrantClient：执行实际的 HTTP 调用
		private readonly client: QdrantClient,
		// ConfigService：读取 collection 名等配置
		private readonly config: ConfigService,
	) {}

	// 获取「知识库分片向量」所在的 collection 名（按向量档位区分维度）
	getKnowledgeCollectionName(tier: KnowledgeVectorTier = 'default'): string {
		if (tier === 'member') {
			return (
				this.config.get<string>(
					QdrantEnum.QDRANT_KNOWLEDGE_COLLECTION_MEMBER,
				) || 'knowledge_chunks_qwen3_2560'
			);
		}
		return (
			this.config.get<string>(QdrantEnum.QDRANT_KNOWLEDGE_COLLECTION) ||
			'knowledge_chunks_v2'
		);
	}

	/** 所有知识库向量 collection（删除文档时需双库清理） */
	getAllKnowledgeCollectionNames(): string[] {
		return [
			this.getKnowledgeCollectionName('default'),
			this.getKnowledgeCollectionName('member'),
		];
	}

	// 确保 collection 存在：不存在则创建（幂等）
	async ensureKnowledgeCollection(options: {
		vectorSize: number;
		collectionName?: string;
	}): Promise<void> {
		const name =
			options.collectionName ?? this.getKnowledgeCollectionName('default');
		// try：若 collection 已存在则直接结束
		try {
			// 读取 collection 元信息（存在则成功）
			await this.client.getCollection(name);
		} catch {
			// 创建 collection
			await this.client.createCollection(name, {
				// Cosine（余弦相似度）适用于文本向量检索
				vectors: { size: options.vectorSize, distance: 'Cosine' },
			});
		}
	}

	// 删除某篇知识库文档的全部向量点
	async deleteKnowledgePointsByKnowledgeId(
		knowledgeId: string,
		collectionName?: string,
	): Promise<void> {
		const names = collectionName
			? [collectionName]
			: this.getAllKnowledgeCollectionNames();
		for (const name of names) {
			try {
				await this.client.delete(name, {
					filter: {
						must: [{ key: 'knowledgeId', match: { value: knowledgeId } }],
					},
				});
			} catch {
				// collection 可能尚未创建，忽略
			}
		}
	}

	// upsert：存在则更新，不存在则插入（幂等写入）
	async upsertKnowledgeChunks(input: {
		points: Array<{
			id: string;
			vector: number[];
			payload: QdrantKnowledgePayload;
		}>;
		collectionName?: string;
	}): Promise<void> {
		const name =
			input.collectionName ?? this.getKnowledgeCollectionName('default');
		await this.client.upsert(name, { points: input.points });
	}

	// 向量检索：根据 query 向量召回最相似的 topK 个分片
	async searchKnowledgeChunks(input: {
		vector: number[];
		topK: number;
		authorId?: number | null;
		collectionName?: string;
	}): Promise<
		// 每条结果包含 score、payload、id
		Array<{
			// 相似度得分（与 distance=Cosine 相关）
			score: number;
			// 命中点 payload：用于构造证据与上下文
			payload: QdrantKnowledgePayload;
			// 点 ID：Qdrant 可能返回 string 或 number
			id: string | number;
		}>
	> {
		const name =
			input.collectionName ?? this.getKnowledgeCollectionName('default');
		// 若传了 authorId，则构造 filter；否则不加 filter
		const filter = input.authorId
			? {
					// must：payload.authorId == authorId
					must: [{ key: 'authorId', match: { value: input.authorId } }],
				}
			: undefined;
		// 调用 Qdrant search
		const res = await this.client.search(name, {
			// query vector
			vector: input.vector,
			// topK（limit）
			limit: input.topK,
			// 返回 payload（否则无法构造 RAG 上下文）
			with_payload: true,
			// 条件合并：仅在有 filter 时传入
			...(filter ? { filter } : {}),
		});

		// 映射为稳定的业务结构（避免上层依赖 SDK 的细节类型）
		return (res as any).map((x: any) => ({
			// 透传得分
			score: x.score,
			// 断言 payload 类型（写入端保证结构一致）
			payload: x.payload as QdrantKnowledgePayload,
			// 透传点 ID
			id: x.id,
		}));
	}
}
