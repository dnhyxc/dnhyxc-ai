import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { EbookAssistantSession } from './ebook-assistant-session.entity';

export enum EbookAssistantMessageRole {
	USER = 'user',
	ASSISTANT = 'assistant',
}

@Entity('ebook_assistant_messages')
@Index('idx_ebook_assistant_msg_session_created', ['session', 'createdAt'])
@Index('idx_ebook_assistant_msg_session_turn', ['session', 'turnId'])
export class EbookAssistantMessage {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(
		() => EbookAssistantSession,
		(s) => s.messages,
		{
			onDelete: 'CASCADE',
		},
	)
	@JoinColumn({ name: 'session_id' })
	session: EbookAssistantSession;

	@Column({
		type: 'enum',
		enum: EbookAssistantMessageRole,
	})
	role: EbookAssistantMessageRole;

	@Column({ name: 'turn_id', type: 'varchar', length: 36, nullable: true })
	turnId: string | null;

	@Column({ type: 'longtext' })
	content: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;
}
