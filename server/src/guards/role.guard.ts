import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enum/roles.enum';
import { UserService } from '../services/user/user.service';

// 鉴权守卫 guard，这个守卫只针对用户的角色（管理员，普通用户）进行判断是否有访问该路由的权限，颗粒度为路由级别
@Injectable()
export class RoleGuard implements CanActivate {
	/**
	 * Reflector 用于读取装饰器写入的“元数据”。
	 * 在 NestJS 中，装饰器（如 @Roles()）会把信息注册到类或方法上，
	 * Reflector 负责在运行时把这些元数据取出来，
	 * 供守卫、拦截器等组件使用，从而实现基于装饰器的权限控制。
	 */
	constructor(
		private reflector: Reflector,
		private userService: UserService,
	) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		// 通过 Reflector 从“处理器”和“控制器类”两个层级上同时读取元数据，
		// 如果两者都定义了 ROLES_KEY（即 @Roles() 装饰器），
		// getAllAndOverride 会优先返回“处理器”上的值，否则返回“类”上的值。
		// getAllAndMerge 会合并类上的及当前路由上的元数据，并返回一个数组。getAllAndOverride 只会优先返回当前路由上的数据，忽略掉最上层类装饰器上的数据。
		// 最终拿到当前请求所需要匹配的角色数组（Role[]）。
		const requireRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
			context.getHandler(), // 当前路由的处理函数（如 @Get() 修饰的方法），获取到的数据是通过 SetMetadata 附加的元数据 @Roles(Role.USER) -> roles（ROLES_KEY）: 2
			context.getClass(), // 当前路由所属的控制器类，获取到的数据是通过 SetMetadata 附加的元数据 @Roles(Role.ADMIN) -> roles（ROLES_KEY）: 1
		]);
		if (!requireRoles) {
			return true;
		} else {
			const req = context.switchToHttp().getRequest();
			const user = await this.userService.findByUsername(req?.user?.username);
			const roleIds = user?.roles?.map((u) => u.id);
			const res = requireRoles.some((r) => roleIds?.includes(r));
			if (res) {
				return res;
			} else {
				throw new UnauthorizedException('无权操作');
			}
		}
	}
}
