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

	@Column({ type: 'int', name: 'chapter_index', nullable: true })
	chapterIndex: number | null;

	@Column({
		type: 'varchar',
		length: 512,
		name: 'chapter_href',
		nullable: true,
	})
	chapterHref: string | null;

	@Column({ type: 'float', name: 'scroll_percent', nullable: true })
	scrollPercent: number | null;

	/** 本书听书倍速覆盖；null = 用用户全局 listen_rate */
	@Column({ type: 'float', name: 'listen_rate', nullable: true })
	listenRate: number | null;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
