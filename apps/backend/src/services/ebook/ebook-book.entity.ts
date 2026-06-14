import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

export type EbookSrcKind = 'path' | 'store';

@Entity('ebook_book')
@Index('idx_ebook_book_user_added', ['userId', 'createdAt'])
export class EbookBook {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({ type: 'int', name: 'user_id' })
	userId: number;

	@Column({ type: 'varchar', length: 8 })
	fmt: 'epub' | 'pdf';

	@Column({ type: 'varchar', length: 512 })
	title: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	author: string | null;

	@Column({ type: 'varchar', length: 16, name: 'src_kind' })
	srcKind: EbookSrcKind;

	/** Tauri 本地绝对路径（仅元数据同步，文件仍在本机） */
	@Column({ type: 'varchar', length: 1024, name: 'local_path', nullable: true })
	localPath: string | null;

	/** 服务端落盘相对路径（uploads/ebooks/...） */
	@Column({ type: 'varchar', length: 512, name: 'file_path', nullable: true })
	filePath: string | null;

	@Column({ type: 'bigint', nullable: true })
	size: string | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
