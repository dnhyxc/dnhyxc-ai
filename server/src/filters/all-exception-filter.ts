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

		console.log(exception, 'all-exception-filter-exception');

		const httpStatus =
			exception instanceof HttpException
				? exception.getStatus()
				: HttpStatus.INTERNAL_SERVER_ERROR;

		const exceptionResponse =
			exception instanceof HttpException
				? exception.getResponse()
				: 'Internal Server Error';

		const responseBody = {
			headers: request.headers,
			query: request.query,
			body: request.body,
			params: request.params,
			timestamp: new Date().toISOString(),
			// ip 信息获取
			ip: requestIp.getClientIp(request),
			exception: exception.name,
			error: exceptionResponse || 'Internal Server Error',
			code: httpStatus,
			path: httpAdapter.getRequestUrl(request),
			method: request.method,
			message: exception.message,
		};

		const status = exception.getStatus();

		// 记录错误日志
		this.logger.error('[dnhyxc-ai]', responseBody);

		httpAdapter.reply(response, responseBody, status);
	}
}
