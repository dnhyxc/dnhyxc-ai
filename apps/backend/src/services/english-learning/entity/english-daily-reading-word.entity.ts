import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

export type ReadingWordSurface = 'selection' | 'gloss' | 'glossary';

export type ReadingWordSource = {
	readingId: string;
	titleEn: string;
	titleZh: string;
	sentence: string;
	surface: ReadingWordSurface;
	collectedAt: string;
};

/** 同一用户同一词一行。多篇来源放在 sources，不另建来源表。 */
@Entity('english_daily_reading_words')
@Index('UQ_edrw_user_word_key', ['userId', 'wordKey'], { unique: true })
@Index('IDX_edrw_user_updated', ['userId', 'updatedAt'])
export class EnglishDailyReadingWord {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'word_key', type: 'varchar', length: 80 })
	wordKey!: string;

	@Column({ type: 'varchar', length: 200 })
	word!: string;

	@Column({ type: 'varchar', length: 500, default: '' })
	zh!: string;

	@Column({ name: 'zh_edited', type: 'boolean', default: false })
	zhEdited!: boolean;

	@Column({ type: 'json' })
	sources!: ReadingWordSource[];

	@CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
	updatedAt!: Date;
}
