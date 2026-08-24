import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	Unique,
} from 'typeorm';

/**
 * 学习笔记正文附件（当前仅 COS 图片 notes/…）。
 * 按 note_id 关联；同 key 可出现在多篇笔记（多行），删文时按 key 引用计数回收 COS。
 */
@Entity({ name: 'english_learning_note_attachment' })
// 创建唯一约束，防止重复数据。'noteId', 'cosKey' 二元组合不能重复
@Unique('UQ_elna_note_key', ['noteId', 'cosKey'])
// 创建索引，加速查询。'noteId' 索引加速按笔记查询附件，'cosKey' 索引加速按 COS key 查询附件
@Index('IDX_elna_note', ['noteId'])
// 创建索引，加速查询。'cosKey' 索引加速按 COS key 查询附件
@Index('IDX_elna_cos_key', ['cosKey'])
export class EnglishLearningNoteAttachment {
	// 主键，自动生成 UUID
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	/** 笔记 ID */
	@Column({ name: 'note_id', type: 'varchar', length: 36 })
	noteId!: string;

	/** COS 对象键，如 notes/{uuid}_name.png */
	@Column({ name: 'cos_key', type: 'varchar', length: 512 })
	cosKey!: string;

	/** 持久化公网 URL（编辑器 img src） */
	@Column({ type: 'varchar', length: 1024 })
	url!: string;

	/** 创建时间 */
	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;
}
