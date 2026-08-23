import {
	Column,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

/** 单词库 / 语句库 / 收藏 / 错题集等列表续读进度（按浏览用户隔离） */
export type EnglishLibraryItemsResumeKind = 'vocab' | 'classic';

@Entity('english_library_items_resume')
@Index('UQ_elir_user_kind_library', ['userId', 'libraryKind', 'libraryId'], {
	unique: true,
})
/** 按库批量清理（删库 / 取消公开） */
@Index('idx_elir_kind_library', ['libraryKind', 'libraryId'])
export class EnglishLibraryItemsResume {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'library_kind', type: 'varchar', length: 16 })
	libraryKind!: EnglishLibraryItemsResumeKind;

	@Column({ name: 'library_id', type: 'varchar', length: 36 })
	libraryId!: string;

	/** 词条列表续读 offset（页起点） */
	@Column({ name: 'resume_offset', type: 'int', default: 0 })
	resumeOffset!: number;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
