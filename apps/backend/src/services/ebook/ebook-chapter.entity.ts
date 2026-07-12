import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('ebook_chapter')
@Index('idx_ebook_chapter_book_index', ['bookId', 'chapterIndex'], {
	unique: true,
})
export class EbookChapter {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'uuid', name: 'book_id' })
	bookId: string;

	@Column({ type: 'int', name: 'chapter_index' })
	chapterIndex: number;

	@Column({ type: 'varchar', length: 512 })
	href: string;

	@Column({ type: 'varchar', length: 512, default: '' })
	title: string;

	@Column({ type: 'int', default: 0 })
	level: number;

	@Column({ type: 'mediumtext' })
	html: string;

	@Column({ type: 'int', name: 'word_count', default: 0 })
	wordCount: number;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;
}
