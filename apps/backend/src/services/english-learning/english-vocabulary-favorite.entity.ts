import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 用户收藏的单词（与生成列表中的词条对应；同一用户同一规范化词形仅一行）。
 */
@Entity('english_vocabulary_favorite')
@Index('UQ_evf_user_word_key', ['userId', 'wordKey'], { unique: true })
export class EnglishVocabularyFavorite {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	/** 规范化词形：trim + 小写，用于去重与批量查询 */
	@Column({ name: 'word_key', type: 'varchar', length: 200 })
	wordKey!: string;

	/** 收藏时的展示原文（保留大小写等） */
	@Column({ type: 'varchar', length: 500 })
	word!: string;

	@Column({ type: 'varchar', length: 500, default: '' })
	ipa!: string;

	@Column({ name: 'translation_zh', type: 'text' })
	translationZh!: string;

	@Column({ type: 'text' })
	example!: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
