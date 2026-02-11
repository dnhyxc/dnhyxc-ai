import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Attachments } from './attachments.entity';
import { ChatSessions } from './session.entity';

export enum MessageRole {
	SYSTEM = 'system',
	USER = 'user',
	ASSISTANT = 'assistant',
}

@Entity()
export class ChatMessages {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({
		type: 'enum',
		enum: MessageRole,
	})
	role: MessageRole;

	@Column('text')
	content: string;

	@Column({ type: 'text', nullable: true })
	parentId: string | null;

	@Column('simple-array', { nullable: true })
	childrenIds: string[];

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	// 关联到会话
	@ManyToOne(
		() => ChatSessions,
		(session) => session.messages,
		{
			onDelete: 'CASCADE', // 如果会话删除，消息级联删除
		},
	)
	@JoinColumn()
	// @JoinColumn({ name: 'session_id' })
	session: ChatSessions;

	// 一对多关系：一条消息可以包含多个附件
	@OneToMany(
		() => Attachments,
		(attachment) => attachment.message,
		{
			cascade: true, // 关键：允许级联保存，保存 Message 时自动保存 Attachment
			eager: true, // (可选) 查询消息时自动加载附件
		},
	)
	attachments: Attachments[];
}
