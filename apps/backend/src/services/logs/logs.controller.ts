import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { Can, CheckPolicies } from '../../decorators/casl.decorator';
import { Serialize } from '../../decorators/serialize.decorator';
import { Action } from '../../enum/action.enum';
import { AdminGuard } from '../../guards/admin.guard';
import { CaslGuard } from '../../guards/casl.guard';
import { JwtGuard } from '../../guards/jwt.guard';
import { Logs } from './logs.entity';

class LogsDto {
	@IsString()
	@IsNotEmpty()
	msg: string;

	@IsString()
	id: string;

	@IsString()
	name: string;
}

class PublicLogsDto {
	@Expose()
	msg: string;
	@Expose()
	name: string;
}

@Controller('logs')
// UseGuards 用于在控制器或路由处理器级别注册守卫（Guards），守卫会在请求到达控制器方法之前执行，以决定是否允许继续处理请求。
// 守卫的执行顺序为从左到右：JwtGuard -> AdminGuard -> CaslGuard。
// JwtGuard：验证请求是否携带有效的 JWT 访问令牌，确保用户已登录。
// AdminGuard：检查当前用户是否具备管理员身份，只有管理员才能继续访问。
// CaslGuard：基于 CASL 权限策略，检查用户是否拥有对目标资源（这里是 Logs）执行特定操作的权限。
// 只有当所有守卫都通过时，请求才会被放行到控制器方法。
@UseGuards(JwtGuard, AdminGuard, CaslGuard)
// @CheckPolicies 是自定义装饰器，用于在方法或控制器级别动态注册 CASL 权限策略检查。
// 它接收一个回调函数，参数为当前用户的 ability 实例（由 CaslGuard 注入），回调需返回布尔值。
// 只有当回调返回 true 时，请求才会被放行；否则抛出 ForbiddenException，阻止访问。
// 与类级别的 @Can 不同，@CheckPolicies 可在运行时根据请求参数或业务逻辑做更细粒度判断。
@CheckPolicies((ability) => ability.can(Action.READ, Logs)) // 配合 CaslGuard 使用的
@Can(Action.READ, Logs) // 配合 CaslGuard 使用的
export class LogsController {
	@Get('/getLogs')
	@Can(Action.READ, Logs)
	getLogs() {
		return 'get logs';
	}

	@Post('/addLogs')
	// @Cannot(Action.CREATE, Logs)
	@Can(Action.CREATE, Logs)
	// 添加 SerializeInterceptor 后置拦截器对响应字段进行序列化
	// @UseInterceptors(new SerializeInterceptor(PublicLogsDto))
	// 使用自定义的 Serialize 系列化装饰器对响应字段进行序列化
	@Serialize(PublicLogsDto)
	addLogs(@Body() dto: LogsDto) {
		return dto;
	}
}
