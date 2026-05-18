import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { EnglishClassicQuotesLibrary } from './english-classic-quotes-library.entity';

/**
 * 经典语句库内的单条语句（一行一句），支持按库分页、排序。
 */
@Entity('english_classic_quotes_library_item')
@Index('idx_ecqli_library_sort', ['libraryId', 'sortOrder'])
@Index('idx_ecqli_user_library', ['userId', 'libraryId'])
export class EnglishClassicQuotesLibraryItem {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'library_id', type: 'varchar', length: 36 })
	libraryId!: string;

	@ManyToOne(
		() => EnglishClassicQuotesLibrary,
		(lib) => lib.items,
		{ onDelete: 'CASCADE' },
	)
	@JoinColumn({ name: 'library_id' })
	library!: EnglishClassicQuotesLibrary;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'sort_order', type: 'int' })
	sortOrder!: number;

	@Column({ type: 'text' })
	english!: string;

	@Column({ name: 'translation_zh', type: 'text' })
	translationZh!: string;

	@Column({ type: 'varchar', length: 2000, default: '' })
	source!: string;

	@Column({ name: 'note_zh', type: 'text' })
	noteZh!: string;
}
