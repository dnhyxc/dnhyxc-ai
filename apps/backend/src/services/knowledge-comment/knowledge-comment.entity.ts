import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

export type CommentAudience = 'owner' | 'readers';

@Entity({ name: 'knowledge_comment' })
@Index('IDX_knowledge_comment_doc_created', ['knowledgeId', 'createdAt'])
@Index('IDX_knowledge_comment_parent', ['parentId', 'createdAt'])
export class KnowledgeComment {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'knowledge_id', type: 'varchar', length: 36 })
	knowledgeId: string;

	@Column({ name: 'user_id', type: 'int' })
	userId: number;

	@Column({ name: 'parent_id', type: 'varchar', length: 36, nullable: true })
	parentId: string | null;

	@Column({ name: 'reply_to_user_id', type: 'int', nullable: true })
	replyToUserId: number | null;

	@Column({ type: 'varchar', length: 1000 })
	content: string;

	@Column({ type: 'varchar', length: 16 })
	audience: CommentAudience;

	@Column({ name: 'edited_at', type: 'timestamp', nullable: true })
	editedAt: Date | null;

	@Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
	deletedAt: Date | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;
}
