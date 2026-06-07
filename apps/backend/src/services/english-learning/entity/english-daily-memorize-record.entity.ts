import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * 今日记词 · 词汇库随机练过的单词（按用户 + 词形唯一，保留最近一次快照）
 */
@Entity('english_daily_memorize_record')
@Index('UQ_edmr_user_word_key', ['userId', 'wordKey'], { unique: true })
@Index('IDX_edmr_user_practiced', ['userId', 'practicedAt'])
export class EnglishDailyMemorizeRecord {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'word_key', type: 'varchar', length: 200 })
	wordKey!: string;

	@Column({ type: 'varchar', length: 500 })
	word!: string;

	@Column({ type: 'varchar', length: 500, default: '' })
	ipa!: string;

	@Column({ type: 'varchar', length: 32, default: '' })
	pos!: string;

	@Column({ type: 'varchar', length: 500, default: '' })
	segmentation!: string;

	@Column({ name: 'translation_zh', type: 'text' })
	translationZh!: string;

	@Column({ type: 'text' })
	example!: string;

	@Column({ name: 'last_correct', type: 'boolean', default: false })
	lastCorrect!: boolean;

	@Column({ name: 'practiced_at', type: 'timestamp' })
	practicedAt!: Date;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
