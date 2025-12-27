// 全局错误处理中间件

import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	type LoggerService,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import * as requestIp from 'request-ip';
import { QueryFailedError } from 'typeorm';

// 全局错误处理中间件
@Catch()
export class AllExceptionFilter implements ExceptionFilter {
	constructor(
		private readonly logger: LoggerService,
		private readonly httpAdapterHost: HttpAdapterHost,
	) {}
	catch(exception: HttpException, host: ArgumentsHost) {
		const { httpAdapter } = this.httpAdapterHost;
		const ctx = host.switchToHttp();
		const response = ctx.getResponse();
		const request = ctx.getRequest();

		const httpStatus =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;

		let exceptionResponse =
			exception instanceof HttpException
				? exception.getResponse()
				: 'Internal Server Error';

		if (exception instanceof QueryFailedError) {
			exceptionResponse =
				exception.driverError?.errno === 1062
					? '数据库唯一索引冲突，记录重复'
					: exception.message;
		}

		const responseBody = {
			headers: request.headers,
			query: request.query,
			body: request.body,
			params: request.params,
			method: request.method,
			// ip 信息获取
			ip: requestIp.getClientIp(request),
			timestamp: new Date().toLocaleString('zh-CN'),
			exception: exception.name,
			path: httpAdapter.getRequestUrl(request),
			error: exceptionResponse,
			success: false,
			code: httpStatus,
			message: exception.message,
		};

		const status = exception?.getStatus?.() || httpStatus || 520;

		// 记录错误日志
		this.logger.error('[dnhyxc-ai]', responseBody);

		httpAdapter.reply(response, responseBody, status);
	}
}
