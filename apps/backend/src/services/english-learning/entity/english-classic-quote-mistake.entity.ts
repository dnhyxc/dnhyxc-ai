import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 用户语句错题集：练习拼写错误的经典句快照；同一用户同一内容键仅一行。
 */
@Entity('english_classic_quote_mistake')
@Index('UQ_ecqm_user_content', ['userId', 'contentKey'], { unique: true })
export class EnglishClassicQuoteMistake {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

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

	@Column({
		name: 'last_user_input',
		type: 'varchar',
		length: 12000,
		default: '',
	})
	lastUserInput!: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
