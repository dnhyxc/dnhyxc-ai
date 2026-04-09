import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 知识库回收站：删除时将原记录快照写入该表，便于后续彻底删除或恢复（可扩展）。
 */
@Entity({ name: 'knowledge_trash' })
export class KnowledgeTrash {
	/** 回收站记录 id */
	@PrimaryGeneratedColumn('uuid')
	id: string;

	/** 原知识库记录 id（knowledge.id） */
	@Column('uuid', { name: 'original_id' })
	originalId: string;

	@Column('text', { nullable: true })
	title: string | null;

	@Column('text', { nullable: true })
	content: string | null;

	@Column('varchar', { nullable: true })
	author: string | null;

	@Column('int', { nullable: true })
	authorId: number | null;

	/** 原记录创建时间（来自 knowledge.createdAt） */
	@Column('timestamp', { name: 'source_created_at', nullable: true })
	sourceCreatedAt: Date | null;

	/** 原记录更新时间（来自 knowledge.updatedAt） */
	@Column('timestamp', { name: 'source_updated_at', nullable: true })
	sourceUpdatedAt: Date | null;

	/** 放入回收站时间（删除时间） */
	@CreateDateColumn({ name: 'deleted_at', type: 'timestamp' })
	deletedAt: Date;
}
