import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Roles } from '../roles/roles.entity';

/**
 * 菜单实体，用于存储系统菜单信息及其权限控制
 */
@Entity()
export class Menus {
	/**
	 * PrimaryGeneratedColumn 主键，使用数据库自增策略自动生成唯一 ID
	 */
	@PrimaryGeneratedColumn()
	id: number;

	/**
	 * 菜单名称，用于展示，Column 标记数据库列，使其持久化到对应表字段
	 */
	@Column()
	name: string;

	/**
	 * 菜单对应的路由路径
	 */
	@Column()
	path: string;

	/**
	 * 菜单排序字段，数值越小排序越靠前
	 */
	@Column()
	order: number;

	/**
	 * 访问控制列表（ACL），用于权限校验的字符串标识
	 */
	@Column()
	acl: string;

	/**
	 * 一个角色可对应多个菜单，用于权限控制
	 * 注意：此处未使用 TypeORM 关系装饰器，实际项目中建议添加 @ManyToMany 或 @OneToMany 等装饰器以建立正式关联
	 */
	@ManyToMany(
		() => Roles,
		(roles) => roles.menus,
	)
	roles: Roles[];
}
