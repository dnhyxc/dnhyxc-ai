import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';
import { EnglishAgentMessage } from './english-agent-message.entity';

/** 英语学习 Agent 业务会话（与 agent_sessions 同 id 作停流句柄） */
@Entity('english_agent_sessions')
@Index('idx_english_agent_session_user_updated', ['userId', 'updatedAt'])
export class EnglishAgentSession {
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
		() => EnglishAgentMessage,
		(m) => m.session,
		{ cascade: true, eager: false },
	)
	messages: EnglishAgentMessage[];
}
