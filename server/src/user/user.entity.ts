import { Exclude } from 'class-transformer';
import {
	AfterInsert,
	AfterRemove,
	Column,
	Entity,
	JoinTable,
	ManyToMany,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Logs } from '../logs/logs.entity';
import { Roles } from '../roles/roles.entity';
import { Profile } from './profile.entity';

@Entity()
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	// unique: true -> 设置数据库 username 键值为唯一值
	@Column({ unique: true })
	username: string;

	@Column()
	@Exclude() // 使用 Exclude 在响应时忽略 password 字段返回
	password: string;

	// 表示一个用户对应多个日志信息，即建立一个 typescript 与数据库之间的关联关系，相当于建立了一个 mapping
	@OneToMany(
		() => Logs,
		(logs) => logs.user,
	)
	logs: Logs[];

	@ManyToMany(
		() => Roles,
		(roles) => roles.users,
	)

	/**
	 * JoinTable 用于在 @ManyToMany 关系中声明“拥有方”，
	 * 它会在数据库中自动生成一张中间表，用来存储两端实体的主键对应关系。
	 * 此处将中间表命名为 user_roles，默认表名会是 user_roles_roles，
	 * 显式指定后更直观，便于后续查询与维护。
	 */
	@JoinTable({
		name: 'user_roles', // 指定中间表（联结表）的名称为 user_roles
	})
	roles: Roles[];

	@OneToOne(
		() => Profile,
		// 这里如果不写这个引用关系，查询 profile 数据时，会报：Cannot read properties of undefined (reading 'joinColumns')"
		(profile) => profile.user,
		{
			// cascade: true 表示开启级联操作。
			// 当保存（save）或删除（remove）当前 User 实体时，
			// TypeORM 会自动级联保存或删除与之关联的 Profile 实体，
			// 无需手动先处理 Profile，简化代码并保证数据一致性。
			// 这里不设置 cascade为 true 则不会将修改的 profile 数据更新到数据库 Profile 表中
			cascade: true,
		},
	)
	profile: Profile;

	// remove 方法触发
	@AfterRemove()
	afterRemove() {
		// console.log('afterRemove', this.id, this.username);
	}

	// insert 方法触发
	@AfterInsert()
	afterInsert() {
		// console.log('afterInsert');
	}
}
