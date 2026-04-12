import {
	Column,
	CreateDateColumn,
	Entity,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'knowledge' })
export class Knowledge {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column('text', { nullable: true })
	title: string | null;

	/** longtext：避免正文超过 MySQL TEXT（约 64KB）时出现 Data too long for column 'content' */
	@Column({ type: 'longtext', nullable: true })
	content: string;

	@Column('varchar', { nullable: true })
	author: string | null;

	@Column('int', { nullable: true })
	authorId: number | null;

	@CreateDateColumn({ name: 'created_at', type: 'timestamp' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
	updatedAt: Date;
}
