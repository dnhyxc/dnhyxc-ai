// 通过 casl/ability 来控制权限 Servives
import {
	AbilityBuilder,
	createMongoAbility,
	ExtractSubjectType,
	Subject,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { getEntities } from '../../utils/common';
// import { Logs } from '../logs/logs.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class CaslAbilityService {
	constructor(private userService: UserService) {}
	async forRoot(username: string) {
		const { can, build } = new AbilityBuilder(createMongoAbility);

		/**
		 * 控制权限的思路：
		 * 1. menu 名称、路径、acl -> actions -> 名称、路径 -> 实体对应
		 * path -> prefix -> 写死在项目代码里
		 *
		 * 2. acl -> 通过表来进行存储 -> LogController（就是每个模块的命名，如： LogsController、UserController） + Action，
		 * 即通过 action（READ、CREATE、UPDATE、DELETE、MANAGE）和 Controller（LogsController、UserController）来进行对应。
		 * 模块的名称可以在 guard 中，通过 canActivate 方法中的 context.getClass().name 来获取到当前模块的名称 LogsController。
		 *
		 * 3. 生产一般采用一个独立的表进行管理对应关系，log -> sys:log -> sys:log:read, sys:log:write
		 *
		 * 上述这些方式的颗粒度也只是到了路由层面，如果需要更细的可以颗粒度，可以给 @Can、@Cannot、@CheckPolicies 装饰器添加第三个参数 conditions 来进行更细粒度的权限控制。
		 * 即：ability.can(action, subject, conditions)
		 *
		 * import { defineAbility } from '@casl/ability'
		 *
		 * const user = {
		 * 	 id: 1,
		 *   isAdmin: true,
		 * }
		 *
		 * class Logs {
		 * 	 constructor(attrs) {
		 * 		 Object.assign(this, attrs);
		 * 	 }
		 * }
		 *
		 * const ability = defineAbility((can) => {
		 *   can('read', Logs);
		 *
		 *   can('update', Logs, ['content'], { isPublished: true, author: user.id });
		 *   // cannot('update', Logs, { isPublished: true });
		 *   can('delete', Logs, { isPublished: true });
		 *
		 * 	 if (user.isAdmin) {
		 *     can('update', 'Logs');
		 *     can('delete', 'Logs');
		 * 	 }
		 * })
		 *
		 * const newLogs = new Logs({ isPublished: true, author: user.id });
		 *
		 * const flag = ability.can('update', newLogs, 'content');
		 * console.log(flag); // true
		 */

		// TODO：这里使用方式一，写死在项目中，后续进行优化，通过数据库表来存储
		const user = await this.userService.findByUsername(username);

		// user -> 1:n roles -> 1:n menus -> 去重 {}
		// can('read', Logs);
		// can('update', Logs);
		// can('manage', 'all');
		// 一个 user 可以对应多个 role，一个 role 可以对应多个 menu，因此需要进行去重操作

		// 对用户所有角色的菜单进行去重，避免重复授权
		const menuMap = new Map<string, any>();
		user?.roles.forEach((role) => {
			role.menus.forEach((menu) => {
				// 以 path 为唯一键，确保同一 path 的菜单只处理一次
				if (!menuMap.has(menu.path)) {
					menuMap.set(menu.path, menu);
				}
			});
		});

		// 遍历去重后的菜单，统一授权
		menuMap.forEach((menu) => {
			// path -> acl -> actions
			const actions = menu.acl.split(','); // [create, read, update, delete, manage]，MANAGE（管理所有，包括创建、读取、更新、删除）
			const entities = getEntities(menu.path);
			actions.forEach((action) => {
				can(action, entities);
			});
		});

		const ability = build({
			detectSubjectType: (object) =>
				object.constructor as ExtractSubjectType<Subject>,
		});

		return ability;
	}
}
