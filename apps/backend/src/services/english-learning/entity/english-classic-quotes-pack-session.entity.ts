import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * 单次经典句拉取会话元数据（一行一流）。
 */
@Entity('english_classic_quotes_pack_session')
@Index('idx_ecqps_user_updated', ['userId', 'updatedAt'])
export class EnglishClassicQuotesPackSession {
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
