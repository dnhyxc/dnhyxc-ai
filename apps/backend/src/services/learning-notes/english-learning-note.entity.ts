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

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
