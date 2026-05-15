import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

/** 与 VocabularyItemDto 一致，存 JSON 列 */
export type EnglishVocabularyPackItemJson = {
	word: string;
	ipa: string;
	/** 词性英文缩写，如 n / v / adj（旧数据可能缺省） */
	pos?: string;
	translationZh: string;
	example: string;
};

/**
 * 单词包流式生成：每一轮 LLM 合并后的新词条落一行，便于审计与按 streamId 还原完整列表。
 */
@Entity('english_vocabulary')
@Index('idx_ev_pack_batch_user_stream_round', ['userId', 'streamId', 'round'])
export class EnglishVocabularyPackBatch {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	/** 单次「生成」会话 id，同一次流内多轮共用一个 streamId */
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

	/** 本轮新增的词条（JSON 数组） */
	@Column({ type: 'json' })
	items!: EnglishVocabularyPackItemJson[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
