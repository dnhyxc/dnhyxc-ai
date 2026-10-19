import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type DailyReadingGenStatus = 'done' | 'stopped' | 'error' | 'paused';

/** 某个用户一次手动生成的弹窗快照。进行中的那次不写这里。 */
@Entity('english_daily_reading_gens')
@Index('idx_english_daily_reading_gens_user', ['userId', 'startedAt'])
export class EnglishDailyReadingGen {
	@PrimaryColumn({ type: 'varchar', length: 36 })
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'mediumtext' })
	text!: string;

	@Column({ type: 'int', default: 0 })
	tokens!: number;

	@Column({ name: 'elapsed_ms', type: 'int', default: 0 })
	elapsedMs!: number;

	@Column({ name: 'started_at', type: 'datetime', precision: 3 })
	startedAt!: Date;

	@Column({ type: 'varchar', length: 16 })
	status!: DailyReadingGenStatus;
}
