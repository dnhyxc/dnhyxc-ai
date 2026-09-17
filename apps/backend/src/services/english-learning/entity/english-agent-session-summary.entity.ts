import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * 英语学习 Agent 会话的长对话摘要（与 agent_session_summaries 同套路，消息分表后摘要也落在英语域）。
 * 每会话一行；EnglishTableMemory 多轮变长时把旧消息压成摘要写入本表，
 * 组 LangChain 历史时先塞 summary、再拼 coversBeforeAt 之后的原文，控制 token。
 * 删会话时摘要行一并删除。
 */
@Entity('english_agent_session_summaries')
@Index('idx_english_agent_summary_session', ['sessionId'])
export class EnglishAgentSessionSummary {
	/** 与 english_agent_sessions / agent_sessions 同 id */
	@PrimaryColumn('varchar', { length: 36, name: 'session_id' })
	sessionId: string;

	/** 更早轮次被折叠后的文字摘要 */
	@Column({ type: 'longtext' })
	summary: string;

	/** 水印：早于此时间的消息不再拼入 prompt，已并入 summary */
	@Column({ name: 'covers_before_at', type: 'timestamp', nullable: true })
	coversBeforeAt: Date | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
