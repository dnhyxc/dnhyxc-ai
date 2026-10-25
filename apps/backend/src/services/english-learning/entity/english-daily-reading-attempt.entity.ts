import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 系统日推一轮工人执行。自选生成不写这里。 */
@Entity('english_daily_reading_attempts')
@Index('uq_english_daily_reading_attempts', ['publishDate', 'attemptNo'], {
	unique: true,
})
export class EnglishDailyReadingAttempt {
	@PrimaryGeneratedColumn({ type: 'bigint' })
	id!: string;

	@Column({ name: 'publish_date', type: 'varchar', length: 10 })
	publishDate!: string;

	@Column({ name: 'attempt_no', type: 'int' })
	attemptNo!: number;

	@Column({ name: 'enqueued_at', type: 'datetime', precision: 3 })
	enqueuedAt!: Date;

	@Column({ name: 'started_at', type: 'datetime', precision: 3 })
	startedAt!: Date;

	@Column({ name: 'finished_at', type: 'datetime', precision: 3 })
	finishedAt!: Date;

	@Column({ name: 'elapsed_ms', type: 'int', default: 0 })
	elapsedMs!: number;

	@Column({ type: 'int', default: 0 })
	tokens!: number;

	@Column({ type: 'varchar', length: 16 })
	outcome!: 'ready' | 'failed';

	@Column({ type: 'varchar', length: 500, nullable: true })
	reason!: string | null;
}
