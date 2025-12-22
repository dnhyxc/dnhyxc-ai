// 建立数据库实体
import {
	Column,
	Entity,
	JoinColumn,
	OneToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity()
export class Profile {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	gender: string;

	@Column()
	photo: string;

	@Column()
	address: string;

	// 一对一关系，表示每个 Profile 关联一个 User 信息
	@OneToOne(() => User)
	// @JoinColumn 用于声明当前实体（Profile）在数据库层面拥有外键列
	// 它会在 profile 表中生成一个指向 user 表主键的外键字段（默认列名为 userId）
	// 同时建立唯一约束，确保一对一关系的完整性
	@JoinColumn()
	// 给关联的主键设置别名，不设置默认就是 userId
	// @JoinColumn({ name: 'user_id' })
	user: User;
}
