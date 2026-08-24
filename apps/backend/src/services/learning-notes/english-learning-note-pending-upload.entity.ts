import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	Unique,
} from 'typeorm';

/**
 * 新建笔记尚未落库时的图片上传登记。
 * 保存时按正文认领；放弃会话 / TTL 到期时删 COS，避免孤儿对象。
 */
@Entity({ name: 'english_learning_note_pending_upload' })
@Unique('UQ_elnpu_session_key', ['sessionId', 'cosKey'])
@Index('IDX_elnpu_user_session', ['userId', 'sessionId'])
@Index('IDX_elnpu_created', ['createdAt'])
export class EnglishLearningNotePendingUpload {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'user_id', type: 'int' })
	userId!: number;

	/** 客户端新建笔记会话 UUID */
	@Column({ name: 'session_id', type: 'varchar', length: 36 })
	sessionId!: string;

	@Column({ name: 'cos_key', type: 'varchar', length: 512 })
	cosKey!: string;

	@Column({ type: 'varchar', length: 1024 })
	url!: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
