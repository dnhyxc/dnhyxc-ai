import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

/** 电子书助手跨请求摘要与水印（与 agent_session_summaries 同构） */
@Entity('ebook_assistant_session_summaries')
@Index('idx_ebook_assistant_summary_session', ['sessionId'])
export class EbookAssistantSessionSummary {
	@PrimaryColumn('varchar', { length: 36, name: 'session_id' })
	sessionId: string;

	@Column({ type: 'longtext' })
	summary: string;

	@Column({ name: 'covers_before_at', type: 'timestamp', nullable: true })
	coversBeforeAt: Date | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
