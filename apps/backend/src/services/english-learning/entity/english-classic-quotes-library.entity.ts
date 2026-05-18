import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { EnglishClassicQuotesLibraryItem } from './english-classic-quotes-library-item.entity';

/**
 * 用户经典语句库（包）元数据：标题、条数、创建时间。
 * 具体语句见 {@link EnglishClassicQuotesLibraryItem}。
 */
@Entity('english_classic_quotes_library')
@Index('idx_ecql_user_created', ['userId', 'createdAt'])
export class EnglishClassicQuotesLibrary {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ type: 'varchar', length: 200 })
	title!: string;

	@Column({ name: 'quote_count', type: 'int' })
	quoteCount!: number;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@OneToMany(
		() => EnglishClassicQuotesLibraryItem,
		(item) => item.library,
	)
	items!: EnglishClassicQuotesLibraryItem[];
}
