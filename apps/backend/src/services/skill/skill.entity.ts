import {
	Column,
	CreateDateColumn,
	Entity,
	Index,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

/** 用户可编辑的 Skill / Prompt 指令包（不进知识向量库） */
@Entity({ name: 'skill' })
@Index('IDX_skill_author', ['authorId'])
export class Skill {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column('varchar', { length: 200 })
	title!: string;

	@Column({ type: 'longtext' })
	content!: string;

	@Column({ name: 'author_id', type: 'int' })
	authorId!: number;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt!: Date;
}
