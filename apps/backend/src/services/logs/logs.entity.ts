import {
	Column,
	CreateDateColumn,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../user/user.entity';

@Entity()
export class Logs {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	path: string;

	@Column()
	method: string;

	@Column({ type: 'text' })
	data: string;

	@Column({ type: 'text', nullable: true })
	responseData: string | null;

	@Column()
	result: number;

	@CreateDateColumn({ type: 'timestamp' })
	createTime: Date;

	@ManyToOne(
		() => User,
		(user) => user.logs,
		{ nullable: true },
	)
	@JoinColumn()
	user: User | null;
}
