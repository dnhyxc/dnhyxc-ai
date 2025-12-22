import { Logs } from 'src/logs/logs.entity';
import { Roles } from 'src/roles/roles.entity';
import {
	Column,
	Entity,
	JoinTable,
	ManyToMany,
	OneToMany,
	OneToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Profile } from './profile.entity';

@Entity()
export class User {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	username: string;

	@Column()
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
	)
	profile: Profile;
}
