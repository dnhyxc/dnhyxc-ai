import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { EnglishVocabularyLibraryItem } from './english-vocabulary-library-item.entity';

/**
 * 用户单词库（包）元数据：标题、词数、创建时间。
 * 具体词条见 {@link EnglishVocabularyLibraryItem}，便于分页与检索。
 */
@Entity('english_vocabulary_library')
@Index('idx_evl_user_created', ['userId', 'createdAt'])
@Index('idx_evl_public', ['isPublic'])
export class EnglishVocabularyLibrary {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'varchar', length: 200 })
	title!: string;

	@Column({ name: 'word_count', type: 'int' })
	wordCount!: number;

	/** 为 true 时全站用户可读、可用于记词/练习抽题 */
	@Column({ name: 'is_public', type: 'boolean', default: false })
	isPublic!: boolean;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@OneToMany(
		() => EnglishVocabularyLibraryItem,
		(item) => item.library,
	)
	items!: EnglishVocabularyLibraryItem[];
}
