import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Expose } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { Serialize } from '../decorators/serialize.decorator';
import { AdminGuard } from '../guards/admin.guard';
import { JwtGuard } from '../guards/jwt.guard';

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
@UseGuards(JwtGuard, AdminGuard)
export class LogsController {
	@Get('/getLogs')
	getLogs() {
		return 'get logs';
	}

	@Post('/addLogs')
	// 添加 SerializeInterceptor 后置拦截器对响应字段进行序列化
	// @UseInterceptors(new SerializeInterceptor(PublicLogsDto))
	// 使用自定义的 Serialize 系列化装饰器对响应字段进行序列化
	@Serialize(PublicLogsDto)
	addLogs(@Body() dto: LogsDto) {
		console.log(dto, '参数dto');
		return dto;
	}
}
