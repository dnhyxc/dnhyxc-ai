import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** 实例级硅基/OpenAI 兼容 LLM 运行时配置（单行 singleton） */
@Entity('llm_runtime_config')
export class LlmRuntimeConfig {
	@PrimaryColumn({ type: 'int', default: 1 })
	id!: number;

	@Column({ type: 'boolean', default: false })
	enabled!: boolean;

	@Column({ name: 'base_url', type: 'varchar', length: 512, default: '' })
	baseUrl!: string;

	@Column({ name: 'model_name', type: 'varchar', length: 256, default: '' })
	modelName!: string;

	@Column({ name: 'api_key_enc', type: 'text', nullable: true })
	apiKeyEnc!: string | null;

	@Column({ name: 'updated_by', type: 'int', nullable: true })
	updatedBy!: number | null;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
