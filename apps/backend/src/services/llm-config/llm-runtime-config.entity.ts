import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

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

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
