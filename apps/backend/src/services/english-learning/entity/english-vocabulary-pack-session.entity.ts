import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * 单次单词包拉取会话元数据（一行一流），供历史列表与详情头信息。
 */
@Entity('english_vocabulary_pack_session')
@Index('idx_evps_user_updated', ['userId', 'updatedAt'])
export class EnglishVocabularyPackSession {
	@PrimaryColumn({ name: 'stream_id', type: 'varchar', length: 36 })
	streamId!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'varchar', length: 500 })
	topic!: string;

	@Column({ name: 'target_count', type: 'int' })
	targetCount!: number;

	@Column({ name: 'item_count', type: 'int', default: 0 })
	itemCount!: number;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
