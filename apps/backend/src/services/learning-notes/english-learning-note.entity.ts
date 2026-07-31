import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

/** 英语学习 · 学习笔记（富文本 HTML） */
@Entity({ name: 'english_learning_note' })
@Index('IDX_eln_user_updated', ['userId', 'updatedAt'])
@Index('IDX_eln_public', ['isPublic'])
export class EnglishLearningNote {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'varchar', length: 200, nullable: true })
	title!: string | null;

	/** TipTap HTML；longtext 避免超长正文截断 */
	@Column({ type: 'longtext' })
	content!: string;

	/** 为 true 时任意登录用户可读详情 / 公开列表 */
	@Column({ name: 'is_public', type: 'boolean', default: false })
	isPublic!: boolean;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
