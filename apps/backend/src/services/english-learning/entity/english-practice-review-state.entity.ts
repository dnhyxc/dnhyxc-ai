import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 错题间隔复习调度（与错题表 item_key 对齐） */
@Entity('english_practice_review_state')
@Index('UQ_eprs_user_kind_key', ['userId', 'contentKind', 'itemKey'], {
	unique: true,
})
@Index('IDX_eprs_user_kind_due', ['userId', 'contentKind', 'nextReviewAt'])
export class EnglishPracticeReviewState {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'content_kind', type: 'varchar', length: 16 })
	contentKind!: 'vocab' | 'classic';

	@Column({ name: 'item_key', type: 'varchar', length: 200 })
	itemKey!: string;

	@Column({ name: 'next_review_at', type: 'timestamp' })
	nextReviewAt!: Date;

	@Column({ name: 'interval_days', type: 'int', default: 0 })
	intervalDays!: number;

	@Column({ name: 'repetitions', type: 'int', default: 0 })
	repetitions!: number;

	@Column({
		name: 'ease_factor',
		type: 'decimal',
		precision: 4,
		scale: 2,
		default: '2.50',
	})
	easeFactor!: string;

	@Column({
		name: 'last_result',
		type: 'varchar',
		length: 16,
		default: 'wrong',
	})
	lastResult!: 'correct' | 'wrong';

	@Column({ name: 'last_practiced_at', type: 'timestamp', nullable: true })
	lastPracticedAt!: Date | null;
}
