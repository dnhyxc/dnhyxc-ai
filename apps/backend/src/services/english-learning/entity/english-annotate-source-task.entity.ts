import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

export type AnnotateSourceTaskStatus = 'running' | 'paused' | 'done' | 'error';

export type AnnotateSourceTaskProgress = {
	total: number;
	hit: number;
	miss: number;
	annotated: number;
	failed: number;
	remaining: number;
	tokensPrompt: number;
	tokensCompletion: number;
	tokensTotal: number;
};

/**
 * 用户整集标注任务（卡片/进度快照）。
 * 句内容仍在 english_sentence_word_annotation_cache；续跑靠 miss 跳过。
 */
@Entity('english_annotate_source_task')
@Index('IDX_east_user_updated', ['userId', 'updatedAt'])
@Index('IDX_east_user_source_lib', ['userId', 'source', 'libraryId'])
@Index('IDX_east_user_source_stream', ['userId', 'source', 'streamId'])
export class EnglishAnnotateSourceTask {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'source', type: 'varchar', length: 16 })
	source!: 'library' | 'pack';

	@Column({ name: 'library_id', type: 'varchar', length: 64, nullable: true })
	libraryId!: string | null;

	@Column({ name: 'stream_id', type: 'varchar', length: 128, nullable: true })
	streamId!: string | null;

	@Column({ name: 'title', type: 'varchar', length: 200 })
	title!: string;

	@Column({ name: 'status', type: 'varchar', length: 16 })
	status!: AnnotateSourceTaskStatus;

	@Column({ name: 'progress', type: 'json', nullable: true })
	progress!: AnnotateSourceTaskProgress | null;

	@Column({ name: 'error_message', type: 'text', nullable: true })
	errorMessage!: string | null;

	@CreateDateColumn({ name: 'started_at', type: 'timestamp' })
	startedAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;

	@Column({ name: 'finished_at', type: 'timestamp', nullable: true })
	finishedAt!: Date | null;
}
