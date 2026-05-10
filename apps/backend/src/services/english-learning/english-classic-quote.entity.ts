import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

/** 与 ClassicQuoteItemDto 一致，存 JSON 列 */
export type EnglishClassicQuoteItemJson = {
	english: string;
	translationZh: string;
	source: string;
	noteZh: string;
};

/**
 * 经典语句包流式生成：每轮 LLM 合并后的新条目落一行，按 streamId 还原完整列表。
 */
@Entity('english_classic_quotes')
@Index('idx_ecq_pack_batch_user_stream_round', ['userId', 'streamId', 'round'])
export class EnglishClassicQuotePackBatch {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'stream_id', type: 'varchar', length: 36 })
	streamId!: string;

	@Column({ type: 'int' })
	round!: number;

	@Column({ type: 'varchar', length: 500 })
	topic!: string;

	@Column({ name: 'target_count', type: 'int' })
	targetCount!: number;

	@Column({ type: 'varchar', length: 32, nullable: true })
	level!: string | null;

	@Column({ type: 'json' })
	items!: EnglishClassicQuoteItemJson[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
