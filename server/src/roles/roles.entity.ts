import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Menus } from '../menus/menus.entity';
import { User } from '../user/user.entity';

@Entity()
export class Roles {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@ManyToMany(
		() => User,
		(user) => user.roles,
	)
	users: User[];

	@ManyToMany(
		() => Menus,
		(menus) => menus.role,
	)
	menus: Menus[];
}
