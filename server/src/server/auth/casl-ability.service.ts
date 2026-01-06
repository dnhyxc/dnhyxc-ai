// 通过 casl/ability 来控制权限 Servives
import {
	AbilityBuilder,
	createMongoAbility,
	ExtractSubjectType,
	Subject,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
// import { Logs } from '../logs/logs.entity';
import { UserService } from '../../server/user/user.service';
import { getEntities } from '../../utils/common';

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
		 * 2. acl -> 通过表来进行存储 -> LogController + Action
		 * log -> sys:log -> sys:log:read, sys:log:write
		 */

		// TODO：这里使用方式一，写死在项目中，后续进行优化，通过数据库表来存储
		const user = await this.userService.findByUsername(username);
		user?.roles.forEach((o) => {
			o.menus.forEach((menu) => {
				// path -> acl -> actions
				const actions = menu.acl.split(',');
				const entities = getEntities(menu.path);
				actions.forEach((action) => {
					can(action, entities);
				});
			});
		});

		// user -> 1:n roles -> 1:n menus -> 去重 {}
		// can('read', Logs);
		// can('update', Logs);
		// can('manage', 'all');

		const ability = build({
			detectSubjectType: (object) =>
				object.constructor as ExtractSubjectType<Subject>,
		});

		return ability;
	}
}
