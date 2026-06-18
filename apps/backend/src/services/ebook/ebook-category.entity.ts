import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity('ebook_category')
@Index('idx_ebook_category_user_sort', ['userId', 'sortOrder'])
export class EbookCategory {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'int', name: 'user_id' })
	userId: number;

	@Column({ type: 'varchar', length: 64 })
	name: string;

	@Column({ type: 'int', name: 'sort_order', default: 0 })
	sortOrder: number;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
