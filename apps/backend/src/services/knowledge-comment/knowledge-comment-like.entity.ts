import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'knowledge_comment_like' })
@Index('UQ_knowledge_comment_like', ['commentId', 'userId'], { unique: true })
export class KnowledgeCommentLike {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ name: 'comment_id', type: 'varchar', length: 36 })
	commentId: string;

	@Column({ name: 'user_id', type: 'int' })
	userId: number;
}
