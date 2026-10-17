import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';
import type { ReadingExtras } from '../daily-reading.rules';

export type DailyReadingStatus = 'pending' | 'ready' | 'failed';

/**
 * 全站一天一行。publish_date 是展示日（上海日历），不是任务运行日。
 * 用 varchar 存 YYYY-MM-DD，避免 date 列被驱动按 UTC 转一天。
 */
@Entity('english_daily_readings')
@Index('uq_english_daily_readings_publish_slot', ['publishDate', 'slot'], {
	unique: true,
})
export class EnglishDailyReading {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'publish_date', type: 'varchar', length: 10 })
	publishDate!: string;

	/** 定时篇固定 day；手动篇为该行 id。 */
	@Column({ type: 'varchar', length: 36, default: 'day' })
	slot!: string;

	/** 手动篇的主人。定时篇为空，全员可见。 */
	@Index('idx_english_daily_readings_user')
	@Column({ name: 'user_id', type: 'int', nullable: true })
	userId!: number | null;

	@Column({ type: 'varchar', length: 16, default: 'pending' })
	status!: DailyReadingStatus;

	@Column({ name: 'started_at', type: 'datetime', precision: 6 })
	startedAt!: Date;

	@Column({ name: 'title_en', type: 'varchar', length: 80, default: '' })
	titleEn!: string;

	@Column({ name: 'title_zh', type: 'varchar', length: 80, default: '' })
	titleZh!: string;

	@Column({ name: 'body_en', type: 'text' })
	bodyEn!: string;

	@Column({ name: 'body_zh', type: 'text' })
	bodyZh!: string;

	@Column({ name: 'source_kind', type: 'varchar', length: 8, default: 'llm' })
	sourceKind!: 'llm' | 'web';

	@Column({ name: 'source_url', type: 'varchar', length: 500, nullable: true })
	sourceUrl!: string | null;

	@Column({
		name: 'source_title',
		type: 'varchar',
		length: 200,
		nullable: true,
	})
	sourceTitle!: string | null;

	@Column({ type: 'varchar', length: 32, default: '' })
	theme!: string;

	/** 写成当时的档位和学习块。旧篇为空，详情保持原版式。 */
	@Column({ type: 'json', nullable: true })
	extras!: ReadingExtras | null;

	@CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
	createdAt!: Date;
}
