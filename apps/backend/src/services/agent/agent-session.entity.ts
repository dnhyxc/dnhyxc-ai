import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';
import { AgentMessage } from './agent-message.entity';

/**
 * LangChain Agent 专用会话（与 assistant / chat 会话隔离）
 */
@Entity('agent_sessions')
@Index('idx_agent_session_user_updated', ['userId', 'updatedAt'])
export class AgentSession {
	@PrimaryColumn('varchar', { length: 36 })
	id: string;

	@Column({ type: 'int', name: 'user_id' })
	userId: number;

	@Column({ type: 'varchar', length: 255, nullable: true })
	title: string | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;

	@OneToMany(
		() => AgentMessage,
		(m) => m.session,
		{
			cascade: true,
			eager: false,
		},
	)
	messages: AgentMessage[];
}
