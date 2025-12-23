import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';

// 实现权鉴路由守卫
@Injectable()
export class AdminGuard implements CanActivate {
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
		}
		return false;
	}
}
