import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';
import { AssistantMessage } from './assistant-message.entity';

/**
 * 助手问答会话（与主站 Chat 会话隔离）
 */
@Entity('assistant_sessions')
@Index('idx_assistant_session_user_updated', ['userId', 'updatedAt'])
export class AssistantSession {
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
		() => AssistantMessage,
		(m) => m.session,
		{
			cascade: true,
			eager: false,
		},
	)
	messages: AssistantMessage[];
}
