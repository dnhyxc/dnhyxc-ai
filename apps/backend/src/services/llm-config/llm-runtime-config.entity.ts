import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { VectorSearchProfile } from './llm-vector-profile';

/** 用户级 OpenAI 兼容 LLM 运行时配置（每用户一行） */
@Entity('llm_runtime_config')
export class LlmRuntimeConfig {
	@PrimaryColumn({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'boolean', default: false })
	enabled!: boolean;

	@Column({ name: 'base_url', type: 'varchar', length: 512, default: '' })
	baseUrl!: string;

	@Column({ name: 'model_name', type: 'varchar', length: 256, default: '' })
	modelName!: string;

	@Column({ name: 'api_key_enc', type: 'text', nullable: true })
	apiKeyEnc!: string | null;

	@Column({ name: 'vector_enabled', type: 'boolean', default: false })
	vectorEnabled!: boolean;

	@Column({
		name: 'vector_base_url',
		type: 'varchar',
		length: 512,
		default: '',
	})
	vectorBaseUrl!: string;

	@Column({
		name: 'vector_rerank_url',
		type: 'varchar',
		length: 512,
		default: '',
	})
	vectorRerankUrl!: string;

	@Column({
		name: 'vector_embedding_model',
		type: 'varchar',
		length: 256,
		default: '',
	})
	vectorEmbeddingModel!: string;

	@Column({
		name: 'vector_rerank_model',
		type: 'varchar',
		length: 256,
		default: '',
	})
	vectorRerankModel!: string;

	@Column({
		name: 'vector_collection_name',
		type: 'varchar',
		length: 256,
		default: '',
	})
	vectorCollectionName!: string;

	@Column({ name: 'vector_api_key_enc', type: 'text', nullable: true })
	vectorApiKeyEnc!: string | null;

	/** 用户保存过的多向量库检索档位（collection + embedding/rerank 模型） */
	@Column({ name: 'vector_search_profiles', type: 'json', nullable: true })
	vectorSearchProfiles!: VectorSearchProfile[] | null;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
