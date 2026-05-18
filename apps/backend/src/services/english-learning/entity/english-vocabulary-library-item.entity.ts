import {
	Column,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { EnglishVocabularyLibrary } from './english-vocabulary-library.entity';

/**
 * 单词库内的单条词条（一行一词），支持按库分页、排序与后续检索。
 */
@Entity('english_vocabulary_library_item')
@Index('idx_evli_library_sort', ['libraryId', 'sortOrder'])
@Index('idx_evli_user_library', ['userId', 'libraryId'])
export class EnglishVocabularyLibraryItem {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'library_id', type: 'varchar', length: 36 })
	libraryId!: string;

	@ManyToOne(
		() => EnglishVocabularyLibrary,
		(lib) => lib.items,
		{
			onDelete: 'CASCADE',
		},
	)
	@JoinColumn({ name: 'library_id' })
	library!: EnglishVocabularyLibrary;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	/** 导入顺序（从 0 起），分页默认按此升序 */
	@Column({ name: 'sort_order', type: 'int' })
	sortOrder!: number;

	@Column({ type: 'varchar', length: 500 })
	word!: string;

	@Column({ type: 'varchar', length: 2000, default: '' })
	ipa!: string;

	@Column({ type: 'varchar', length: 64, default: '' })
	pos!: string;

	@Column({ name: 'translation_zh', type: 'text' })
	translationZh!: string;

	@Column({ type: 'text' })
	example!: string;
}
