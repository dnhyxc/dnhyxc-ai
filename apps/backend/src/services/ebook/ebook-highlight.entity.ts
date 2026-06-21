import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('ebook_highlight')
@Index('idx_ebook_highlight_user_book', ['userId', 'bookId'])
export class EbookHighlight {
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

	@Column({ type: 'varchar', length: 16 })
	style: string;

	@Column({ type: 'varchar', length: 16 })
	color: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
