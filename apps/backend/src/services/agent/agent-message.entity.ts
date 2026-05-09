import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import type { SerperOrganicItem } from '../web-search/web-search.types';
import { AgentSession } from './agent-session.entity';

export enum AgentMessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
}

@Entity('agent_messages')
@Index('idx_agent_msg_session_created', ['session', 'createdAt'])
@Index('idx_agent_msg_session_turn', ['session', 'turnId'])
export class AgentMessage {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(
		() => AgentSession,
		(s) => s.messages,
		{
			onDelete: 'CASCADE',
		},
	)
	@JoinColumn({ name: 'session_id' })
	session: AgentSession;

	@Column({
		type: 'enum',
		enum: AgentMessageRole,
	})
	role: AgentMessageRole;

	@Column({ name: 'turn_id', type: 'varchar', length: 36, nullable: true })
	turnId: string | null;

	@Column({ type: 'longtext' })
	content: string;

	/** 联网检索快照（与 Chat 助手消息 searchOrganic 一致），供正文【n】角标渲染为胶囊 */
	@Column({ name: 'search_organic', type: 'json', nullable: true })
	searchOrganic: SerperOrganicItem[] | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;
}
