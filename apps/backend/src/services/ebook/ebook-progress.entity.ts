import {
	Column,
	Entity,
	Index,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('ebook_progress')
@Index('idx_ebook_progress_user', ['userId'])
export class EbookProgress {
	@PrimaryColumn('uuid', { name: 'book_id' })
	bookId: string;

	@Column({ type: 'int', name: 'user_id' })
	userId: number;

	@Column({ type: 'text', name: 'epub_cfi', nullable: true })
	epubCfi: string | null;

	@Column({ type: 'int', name: 'pdf_page', nullable: true })
	pdfPage: number | null;

	@Column({ type: 'float', nullable: true })
	percent: number | null;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
