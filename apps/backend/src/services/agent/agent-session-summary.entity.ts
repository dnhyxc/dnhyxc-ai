import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * 跨请求持久化的对话摘要与水印（早于水印的消息仅通过摘要进入模型上下文）
 */
@Entity('agent_session_summaries')
@Index('idx_agent_summary_session', ['sessionId'])
export class AgentSessionSummary {
	@PrimaryColumn('varchar', { length: 36, name: 'session_id' })
	sessionId: string;

	@Column({ type: 'longtext' })
	summary: string;

	/** 早于此时间的消息行不再拼入 prompt，已并入 summary */
	@Column({ name: 'covers_before_at', type: 'timestamp', nullable: true })
	coversBeforeAt: Date | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
