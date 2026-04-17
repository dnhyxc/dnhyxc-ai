import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { KnowledgeChatSessions } from './knowledge-chat-session.entity';

export enum KnowledgeMessageRole {
	SYSTEM = 'system',
	USER = 'user',
	ASSISTANT = 'assistant',
}

@Entity()
export class KnowledgeChatMessages {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('text', { nullable: true })
	chatId: string;

	@Column('text', { nullable: true })
	currentChatId: string;

	@Column({ type: 'enum', enum: KnowledgeMessageRole })
	role: KnowledgeMessageRole;

	@Column('text')
	content: string;

	@Column({ type: 'text', nullable: true })
	parentId: string | null;

	@Column('simple-array', { nullable: true })
	childrenIds: string[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@Column()
	sessionId: string;

	@ManyToOne(
		() => KnowledgeChatSessions,
		(session) => session.messages,
		{
			onDelete: 'CASCADE',
		},
	)
	@JoinColumn({ name: 'session_id' })
	session: KnowledgeChatSessions;
}
