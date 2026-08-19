import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'knowledge' })
@Index('IDX_knowledge_public', ['isPublic'])
export class Knowledge {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('text', { nullable: true })
	title: string | null;

	/** longtext：避免正文超过 MySQL TEXT（约 64KB）时出现 Data too long for column 'content' */
	@Column({ type: 'longtext', nullable: true })
	content: string;

	@Column('varchar', { nullable: true })
	author: string | null;

	@Column('int', { nullable: true })
	authorId: number | null;

	/** 为 true 时任意登录用户可读详情 / 出现在公开列表 */
	@Column({ name: 'is_public', type: 'boolean', default: false })
	isPublic!: boolean;

	/** 用户自定义分类；删除分类时由服务端置空（未分类） */
	@Column({ name: 'category_id', type: 'varchar', length: 255, nullable: true })
	categoryId: string | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
