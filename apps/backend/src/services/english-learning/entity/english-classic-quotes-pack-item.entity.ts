import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 经典句拉取明细：一行一句，按 streamId + sortOrder 分页读取。
 */
@Entity('english_classic_quotes_pack_item')
@Index('idx_ecqpi_user_stream_sort', ['userId', 'streamId', 'sortOrder'])
@Index('idx_ecqpi_stream_sort', ['streamId', 'sortOrder'])
export class EnglishClassicQuotesPackItem {
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

	@Column({ type: 'text' })
	english!: string;

	@Column({ name: 'translation_zh', type: 'text' })
	translationZh!: string;

	@Column({ type: 'varchar', length: 2000, default: '' })
	source!: string;

	@Column({ name: 'note_zh', type: 'text' })
	noteZh!: string;
}
