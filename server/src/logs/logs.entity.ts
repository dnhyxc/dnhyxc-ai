import { User } from 'src/user/user.entity';
import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Logs {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	path: string;

	@Column()
	method: string;

	@Column()
	data: string;

	@Column()
	result: number;

	// 表示多个用户对应一个用户
	@ManyToOne(
		() => User,
		(user) => user.logs,
	)
	// 表明在 user 表中建立关联关系，即默认会在 logs 表中生成一个 userId 外键字段
	@JoinColumn()
	user: User;
}
