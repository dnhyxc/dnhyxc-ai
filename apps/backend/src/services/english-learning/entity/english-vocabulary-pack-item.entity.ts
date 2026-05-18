import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 单词包拉取明细：一行一词，按 streamId + sortOrder 分页读取。
 */
@Entity('english_vocabulary_pack_item')
@Index('idx_evpi_user_stream_sort', ['userId', 'streamId', 'sortOrder'])
@Index('idx_evpi_stream_sort', ['streamId', 'sortOrder'])
export class EnglishVocabularyPackItem {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'stream_id', type: 'varchar', length: 36 })
	streamId!: string;

	@Column({ type: 'int' })
	round!: number;

	@Column({ name: 'sort_order', type: 'int' })
	sortOrder!: number;

	@Column({ name: 'batch_id', type: 'varchar', length: 36, nullable: true })
	batchId!: string | null;

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
