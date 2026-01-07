import {
	Column,
	Entity,
	JoinTable,
	ManyToMany,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Menus } from '../menus/menus.entity';
import { User } from '../user/user.entity';

@Entity()
export class Roles {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	description: string;

	@ManyToMany(
		() => User,
		(user) => user.roles,
	)
	users: User[];

	@ManyToMany(
		() => Menus,
		(menus) => menus.roles,
		{
			// cascade: true, // 如果在创建角色时，同时创建新的菜单，那么可以设置为 true。但更常见的做法是，菜单是预先配置好的，创建角色时只是关联已有的菜单，所以不需要设置 cascade: true。
			onDelete: 'CASCADE', // 确保删除角色时，中间表的记录也被清理
		},
	)
	// JoinTable 在 TypeORM 中，ManyToMany 关系需要明确指定关系的“拥有方”。拥有方是指哪个实体负责管理中间表（连接表）的关系。在数据库层面，中间表是用来存储两个实体之间的多对多关系的表。
	@JoinTable({
		name: 'roles_menus',
	})
	menus: Menus[];
}
