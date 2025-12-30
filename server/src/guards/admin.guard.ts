import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable,
} from '@nestjs/common';
import { UserService } from '../user/user.service';

// 实现权鉴路由守卫
@Injectable()
export class AdminGuard implements CanActivate {
	// 这里使用到了 UserService，需要在使用的 AdminGuard 的模块注入 UserModule 模块，否则就需要将 UserModule 通过 @Global() 修饰符标记为全局模块，才能正常使用 UserService
	constructor(private userService: UserService) {}
	// 只有当校验通过之后才会走 canActivate 逻辑
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// 1. 获取请求对象
		const req = context.switchToHttp().getRequest();
		// 2. 获取请求中的用户信息进行逻辑上的判断 -> 角色判断
		const user = await this.userService.findByUsername(req?.user?.username);
		// TODO: 权限判断示例，判断什么角色有请求权限
		// if (user && user?.roles?.filter((u) => u.id === 2).length > 0) {
		// 	return true;
		// }
		if (user) {
			return true;
		} else {
			throw new ForbiddenException('暂无权限');
		}
	}
}
