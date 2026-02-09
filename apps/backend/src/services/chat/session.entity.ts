import { IsOptional } from 'class-validator';
import {
	Column,
	CreateDateColumn,
	Entity,
	OneToMany,
	PrimaryColumn,
} from 'typeorm';
import { ChatMessages } from './chat.entity';

@Entity()
export class ChatSessions {
	@PrimaryColumn()
	id: string;

	// 对应 this.partialResponses
	// 用于存储未完成流式传输时的部分内容，以便 continueStream 使用
	@Column({ type: 'text', nullable: true, name: 'partial_content' })
	@IsOptional()
	partialContent: string | null;

	// 对应 this.activeSessions (可选，用于记录会话是否在前端活跃)
	@Column({ type: 'boolean', default: true, name: 'is_active' })
	@IsOptional()
	isActive: boolean;

	// 预留字段：如果需要存储模型配置（如 temperature, model_name）可以加在这里
	// @Column({ type: 'varchar', nullable: true })
	// modelName: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@CreateDateColumn({ name: 'updated_at', type: 'timestamp', update: true })
	updatedAt: Date;

	// 一对多关系：一个会话包含多条消息
	@OneToMany(
		() => ChatMessages,
		(message) => message.session,
		{
			cascade: true, // 允许级联保存和更新
			eager: false, // 按需加载，通常查询会话时手动加载消息以控制顺序
		},
	)
	messages: ChatMessages[];
}
