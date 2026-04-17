import { IsOptional } from 'class-validator';
import {
	Column,
	CreateDateColumn,
	Entity,
	OneToMany,
	PrimaryColumn,
} from 'typeorm';
import { KnowledgeChatMessages } from './knowledge-chat-message.entity';

@Entity()
export class KnowledgeChatSessions {
	@PrimaryColumn()
	id: string;

	@Column({ type: 'varchar', nullable: true, length: 200 })
	@IsOptional()
	title: string;

	@Column({ type: 'boolean', default: true, name: 'is_active' })
	@IsOptional()
	isActive: boolean;

	@Column({ type: 'varchar', nullable: true })
	modelName: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@CreateDateColumn({ name: 'updated_at', type: 'timestamp', update: true })
	updatedAt: Date;

	@OneToMany(
		() => KnowledgeChatMessages,
		(message) => message.session,
		{
			cascade: true,
			eager: false,
		},
	)
	messages: KnowledgeChatMessages[];
}
