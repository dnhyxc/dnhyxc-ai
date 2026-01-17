// 通过 casl/ability 来控制权限的守卫
import {
	CanActivate,
	ExecutionContext,
	HttpException,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
	CaslHandlerType,
	CHECK_POLICIES_KEY,
	PolicyHandlerCallback,
} from '../decorators/casl.decorator';
import { CaslAbilityService } from '../services/auth/casl-ability.service';

/**
 * 如果需要控制权限，需要在每个 Controller 方法上添加 @UseGuards(CaslGuard) 装饰器，
 * 并且还需要在对应的接口之上中添加 @Can(Action.XXX, Logs 或 User 或 Menus 或 Roles 或 'Auth'（因为 Auth 没有 entity.ts 文件，没法导入 Auth，因此只能传字符串 'Auth'）])
 */
@Injectable()
export class CaslGuard implements CanActivate {
	constructor(
		// 从 Reflector 中获取元数据，即获取通过 SetMetadata 装饰器设置的 CHECK_POLICIES_KEY.HANDLER 等元数据
		private reflector: Reflector,
		private caslAbilityService: CaslAbilityService,
	) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const handlers = this.reflector.getAllAndMerge<PolicyHandlerCallback[]>(
			CHECK_POLICIES_KEY.HANDLER,
			[
				context.getHandler(), // 当前路由的处理函数（如 @Get() 修饰的方法）
				context.getClass(), // 当前路由所属的控制器类
			],
		);
		const canHandlers = this.reflector.getAllAndMerge<PolicyHandlerCallback[]>(
			CHECK_POLICIES_KEY.CAN,
			[
				context.getHandler(), // 当前路由的处理函数（如 @Get() 修饰的方法）
				context.getClass(), // 当前路由所属的控制器类
			],
		) as CaslHandlerType;
		const cannotHandlers = this.reflector.getAllAndMerge<
			PolicyHandlerCallback[]
		>(CHECK_POLICIES_KEY.CANNOT, [
			context.getHandler(), // 当前路由的处理函数（如 @Get() 修饰的方法）
			context.getClass(), // 当前路由所属的控制器类
		]) as CaslHandlerType;

		// 判断用户未设置上述的任何一个，那么直接返回 true
		if (!handlers || !canHandlers || !cannotHandlers) {
			return true;
		}

		const req = context.switchToHttp().getRequest();

		if (req?.user) {
			// 获取当前用户权限
			const ability = await this.caslAbilityService.forRoot(req.user?.username);

			let flag = true;

			if (handlers) {
				flag = flag && handlers.every((handler) => handler(ability));
			}

			if (flag && canHandlers) {
				if (Array.isArray(canHandlers)) {
					flag = flag && canHandlers.every((handler) => handler(ability));
				} else if (typeof canHandlers === 'function') {
					flag = flag && canHandlers(ability);
				}
			}

			if (flag && cannotHandlers) {
				if (Array.isArray(cannotHandlers)) {
					flag = flag && cannotHandlers.every((handler) => handler(ability));
				} else if (typeof cannotHandlers === 'function') {
					flag = flag && cannotHandlers(ability);
				}
			}
			if (flag) {
				return true;
			} else {
				throw new UnauthorizedException('无权访问');
			}
		} else {
			throw new HttpException('无权访问', 401);
		}
	}
}
