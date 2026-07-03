import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('ebook_thought')
@Index('idx_ebook_thought_user_book', ['userId', 'bookId'])
@Index('idx_ebook_thought_book_updated', ['bookId', 'updatedAt'])
@Index('idx_ebook_thought_book_deleted', ['bookId', 'deletedAt'])
export class EbookThought {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'int', name: 'user_id' })
	userId: number;

	@Column({ type: 'uuid', name: 'book_id' })
	bookId: string;

	@Column({ type: 'text', name: 'cfi_range' })
	cfiRange: string;

	@Column({ type: 'text' })
	quote: string;

	@Column({ type: 'text' })
	content: string;

	@Column({ name: 'is_public', type: 'boolean', default: true })
	isPublic!: boolean;

	@Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
	deletedAt: Date | null = null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
