import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryColumn,
} from 'typeorm';

export type PracticeReportItemSnapshot = {
	itemKey: string;
	contentKind: 'vocab' | 'classic';
	userInput: string;
	correct: boolean;
	answerText: string;
	translationZh: string;
	ipa?: string;
	pos?: string;
};

/** 单场练习报告（抬头列 + items 快照；主键由客户端 reportId 提供以实现幂等） */
@Entity('english_practice_report')
@Index('IDX_epr_user_created', ['userId', 'createdAt'])
@Index('IDX_epr_user_kind_created', ['userId', 'contentKind', 'createdAt'])
export class EnglishPracticeReport {
	@PrimaryColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	@Column({ name: 'content_kind', type: 'varchar', length: 16 })
	contentKind!: 'vocab' | 'classic';

	@Column({ type: 'varchar', length: 16 })
	mode!: 'dictation' | 'spelling';

	@Column({ type: 'varchar', length: 32 })
	source!: string;

	@Column({ type: 'varchar', length: 16 })
	order!: 'random' | 'sequential';

	@Column({ type: 'int' })
	count!: number;

	@Column({ name: 'source_title', type: 'varchar', length: 200, default: '' })
	sourceTitle!: string;

	@Column({ type: 'varchar', length: 240 })
	title!: string;

	@Column({ name: 'correct_count', type: 'int' })
	correctCount!: number;

	@Column({ name: 'total_count', type: 'int' })
	totalCount!: number;

	@Column({ type: 'json' })
	items!: PracticeReportItemSnapshot[];

	@Column({ name: 'is_retry_wrong', type: 'boolean', default: false })
	isRetryWrong!: boolean;

	@Column({ name: 'save_mode', type: 'varchar', length: 16, default: 'manual' })
	saveMode!: 'manual' | 'auto';

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
