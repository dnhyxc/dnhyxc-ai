import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 用户收藏的经典英文语句（同一用户同一内容键仅一行；键为规范化原文的 SHA256）。
 */
@Entity('english_classic_quote_favorite')
@Index('UQ_ecqf_user_content', ['userId', 'contentKey'], { unique: true })
export class EnglishClassicQuoteFavorite {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	/** 规范化英文原文的 SHA256(hex)，用于去重与批量查询 */
	@Column({ name: 'content_key', type: 'char', length: 64 })
	contentKey!: string;

	@Column({ type: 'text' })
	english!: string;

	@Column({ name: 'translation_zh', type: 'text' })
	translationZh!: string;

	@Column({ type: 'varchar', length: 2000, default: '' })
	source!: string;

	@Column({ name: 'note_zh', type: 'text' })
	noteZh!: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
