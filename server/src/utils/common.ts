import { Logs } from 'src/logs/logs.entity';
import { Menus } from 'src/menus/menus.entity';
import { Roles } from 'src/roles/roles.entity';
import { User } from 'src/user/user.entity';

// 获取对应有权限的实体，用于在 casl-ability.service.ts 中方便 casl/ability 使用来控制权限
export const getEntities = (path: string) => {
	// users -> User, /logs -> Logs, /menus -> Menus, /roles -> Roles, /auth -> 'Auth'
	const map = {
		'/user': User,
		'/logs': Logs,
		'/roles': Roles,
		'/menus': Menus,
		'/auth': 'Auth',
	};

	for (let i = 0; i < Object.keys(map).length; i++) {
		const key = Object.keys(map)[i];
		if (path.startsWith(key)) {
			return map[key];
		}
	}
};
