import { Logs } from '../logs/logs.entity';
import { Menus } from '../menus/menus.entity';
import { Roles } from '../roles/roles.entity';
import { User } from '../user/user.entity';

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

export const randomLightColor = () => {
	// 生成128-255之间的RGB分量，避免深色
	const r = Math.floor(Math.random() * 128) + 128;
	const g = Math.floor(Math.random() * 128) + 128;
	const b = Math.floor(Math.random() * 128) + 128;

	return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};
