// 权限控制自定义装饰器
import { AnyMongoAbility, InferSubjects } from '@casl/ability';
import { SetMetadata } from '@nestjs/common';
import { Action } from '../enum/action.enum';

/**
 * 用于在 NestJS 路由处理器上挂载权限元数据的键名枚举。
 * 守卫（Guard）通过反射读取这些键，拿到对应的策略回调并执行。
 */
export enum CHECK_POLICIES_KEY {
	/** 对应 @CheckPolicies 装饰器，可放置任意自定义策略回调 */
	HANDLER = 'CHECK_POLICIES_HANDLER',
	/** 对应 @Can 装饰器，内部调用 ability.can() */
	CAN = 'CHECK_POLICIES_CAN',
	/** 对应 @Cannot 装饰器，内部调用 ability.cannot() */
	CANNOT = 'CHECK_POLICIES_CANNOT',
}

/**
 * 策略回调类型：接收 CASL 的 Ability 实例，返回 true 表示通过，false 表示拒绝。
 */
export type PolicyHandlerCallback = (ability: AnyMongoAbility) => boolean;

/**
 * 允许单个回调或回调数组，方便装饰器参数灵活书写。
 */
export type CaslHandlerType = PolicyHandlerCallback | PolicyHandlerCallback[];

/**
 * 将一组自定义策略回调挂载到路由元数据上。
 * 守卫通过 CHECK_POLICIES_KEY.HANDLER 取出这些回调并依次执行。
 *
 * @example
 * \@CheckPolicies((ability) => ability.can(Action.Read, 'Article'))
 * async findAll() { ... }
 */
export const CheckPolicies = (...handlers: PolicyHandlerCallback[]) =>
	SetMetadata(CHECK_POLICIES_KEY.HANDLER, handlers);

/**
 * 快速声明“允许”某操作的装饰器，底层调用 ability.can(action, subject, conditions)。
 * 守卫通过 CHECK_POLICIES_KEY.CAN 取出该回调并执行。
 *
 * @param action     动作枚举，如 Action.Read
 * @param subject    主体（资源）类型或对象
 * @param conditions 可选的额外条件，对应 CASL 条件对象
 *
 * @example
 * \@Can(Action.Update, Article)
 * async update(\@Body() dto) { ... }
 */
export const Can = (
	action: Action,
	subject: InferSubjects<any>,
	conditions?: any,
) =>
	SetMetadata(CHECK_POLICIES_KEY.CAN, (ability: AnyMongoAbility) =>
		ability.can(action, subject, conditions),
	);

/**
 * 快速声明“禁止”某操作的装饰器，底层调用 ability.cannot(action, subject, conditions)。
 * 守卫通过 CHECK_POLICIES_KEY.CANNOT 取出该回调并执行。
 *
 * @param action     动作枚举，如 Action.Delete
 * @param subject    主体（资源）类型或对象
 * @param conditions 可选的额外条件，对应 CASL 条件对象
 *
 * @example
 * \@Cannot(Action.Delete, Article, { status: 'published' })
 * async remove() { ... }
 */
export const Cannot = (
	action: Action,
	subject: InferSubjects<any>,
	conditions?: any,
) =>
	SetMetadata(CHECK_POLICIES_KEY.CANNOT, (ability: AnyMongoAbility) =>
		ability.cannot(action, subject, conditions),
	);
