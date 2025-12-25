import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CaslAbilityService } from '../auth/casl-ability.service';
import {
	CaslHandlerType,
	CHECK_POLICIES_KEY,
	PolicyHandlerCallback,
} from '../decorators/casl.decorator';

@Injectable()
export class CaslGuard implements CanActivate {
	constructor(
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

		const ability = this.caslAbilityService.forRoot();

		let flag = true;

		if (handlers) {
			flag = flag && handlers.every((handler) => handler(ability));
		}

		if (canHandlers) {
			if (Array.isArray(canHandlers)) {
				flag = flag && canHandlers.every((handler) => handler(ability));
			} else if (typeof canHandlers === 'function') {
				flag = flag && canHandlers(ability);
			}
		}

		if (cannotHandlers) {
			if (Array.isArray(cannotHandlers)) {
				flag = flag && cannotHandlers.every((handler) => handler(ability));
			} else if (typeof cannotHandlers === 'function') {
				flag = flag && cannotHandlers(ability);
			}
		}

		return true;
	}
}
