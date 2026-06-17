import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	OneToMany,
	PrimaryColumn,
	UpdateDateColumn,
} from 'typeorm';
import { EbookAssistantMessage } from './ebook-assistant-message.entity';

/** 电子书阅读助手会话（与 knowledge assistant / agent 隔离） */
@Entity('ebook_assistant_sessions')
@Index('idx_ebook_assistant_session_user_book_updated', [
	'userId',
	'bookId',
	'updatedAt',
])
@Index('idx_ebook_assistant_session_user_updated', ['userId', 'updatedAt'])
export class EbookAssistantSession {
	@PrimaryColumn('varchar', { length: 36 })
	id: string;

	@Column({ type: 'int', name: 'user_id' })
	userId: number;

	@Column({ type: 'varchar', length: 36, name: 'book_id' })
	bookId: string;

	@Column({ type: 'varchar', length: 255, nullable: true })
	title: string | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;

	@OneToMany(
		() => EbookAssistantMessage,
		(m) => m.session,
		{
			cascade: true,
			eager: false,
		},
	)
	messages: EbookAssistantMessage[];
}
