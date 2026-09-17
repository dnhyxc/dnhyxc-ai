import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { AssistantSession } from './assistant-session.entity';

export enum AssistantMessageRole {
	SYSTEM = 'system',
	USER = 'user',
	ASSISTANT = 'assistant',
}

@Entity('assistant_messages')
@Index('idx_assistant_msg_session_created', ['session', 'createdAt'])
@Index('idx_assistant_msg_session_turn', ['session', 'turnId'])
export class AssistantMessage {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(
		() => AssistantSession,
		(s) => s.messages,
		{
			onDelete: 'CASCADE',
		},
	)
	@JoinColumn({ name: 'session_id' })
	session: AssistantSession;

	@Column({
		type: 'enum',
		enum: AssistantMessageRole,
	})
	role: AssistantMessageRole;

	/**
	 * 同一轮问答：用户消息与助手消息共用同一 turnId，禁止只存一侧。
	 * 助手行可先占位（content 为空），流式结束后再 UPDATE 正文。
	 */
	@Column({ name: 'turn_id', type: 'varchar', length: 36, nullable: true })
	turnId: string | null;

	@Column({ type: 'longtext' })
	content: string;

	/**
	 * 本轮 Agent 强制应用的 Skill 快照（id + title），供刷新后 UI 展示；
	 * 仅助手行有意义，用户行一般为 null。
	 */
	@Column({ name: 'applied_skills', type: 'json', nullable: true })
	appliedSkills: Array<{ id: string; title: string }> | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;
}
