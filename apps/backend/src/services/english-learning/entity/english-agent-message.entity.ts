import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import type { SerperOrganicItem } from '../../web-search/web-search.types';
import { EnglishAgentSession } from './english-agent-session.entity';

export enum EnglishAgentMessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
}

@Entity('english_agent_messages')
@Index('idx_english_agent_msg_session_created', ['session', 'createdAt'])
@Index('idx_english_agent_msg_session_turn', ['session', 'turnId'])
export class EnglishAgentMessage {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(
		() => EnglishAgentSession,
		(s) => s.messages,
		{ onDelete: 'CASCADE' },
	)
	@JoinColumn({ name: 'session_id' })
	session: EnglishAgentSession;

	@Column({
		type: 'enum',
		enum: EnglishAgentMessageRole,
	})
	role: EnglishAgentMessageRole;

	@Column({ name: 'turn_id', type: 'varchar', length: 36, nullable: true })
	turnId: string | null;

	@Column({ type: 'longtext' })
	content: string;

	@Column({ name: 'search_organic', type: 'json', nullable: true })
	searchOrganic: SerperOrganicItem[] | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;
}
