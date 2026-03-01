import { IsNumber, IsString } from 'class-validator';
import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatMessages } from './chat.entity';

@Entity()
export class Attachments {
	@PrimaryGeneratedColumn()
	id: string;

	// 存储文件路径
	@Column({ type: 'varchar', length: 500 })
	path: string;

	@Column()
	@IsString()
	filename: string;

	// (可选) 存储原始文件名，如果 filePath 没有包含名字或者需要显示原名
	@Column({ type: 'varchar', length: 255, nullable: true })
	originalname: string;

	// (可选) 存储文件类型，如 'pdf', 'image'
	@Column({ type: 'varchar', nullable: true })
	mimetype: string;

	@Column()
	@IsNumber()
	size: number;

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date;

	// 多对一关系：多个附件属于一条消息
	@ManyToOne(
		() => ChatMessages,
		(message) => message.attachments,
		{
			onDelete: 'CASCADE', // 消息删除时，附件也删除
		},
	)
	@JoinColumn({ name: 'message_id' })
	message: ChatMessages;
}
