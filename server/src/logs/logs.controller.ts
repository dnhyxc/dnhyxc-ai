import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { Can, CheckPolicies } from '../decorators/casl.decorator';
import { Serialize } from '../decorators/serialize.decorator';
import { Action } from '../enum/action.enum';
// import { AdminGuard } from '../guards/admin.guard';
import { CaslGuard } from '../guards/casl.guard';
// import { JwtGuard } from '../guards/jwt.guard';
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
// @UseGuards(JwtGuard, AdminGuard)
@UseGuards(CaslGuard)
@CheckPolicies((ability) => ability.can(Action.READ, Logs))
@Can(Action.READ, Logs)
export class LogsController {
	@Get('/getLogs')
	@Can(Action.UPDATE, Logs)
	getLogs() {
		return 'get logs';
	}

	@Post('/addLogs')
	// 添加 SerializeInterceptor 后置拦截器对响应字段进行序列化
	// @UseInterceptors(new SerializeInterceptor(PublicLogsDto))
	// 使用自定义的 Serialize 系列化装饰器对响应字段进行序列化
	@Serialize(PublicLogsDto)
	addLogs(@Body() dto: LogsDto) {
		return dto;
	}
}
