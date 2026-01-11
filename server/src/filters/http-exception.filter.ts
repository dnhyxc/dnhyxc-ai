import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	type LoggerService,
} from '@nestjs/common';

// 全局错误处理中间件
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
	constructor(private logger: LoggerService) {}
	catch(exception: HttpException, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse();
		const request = ctx.getRequest();
		const status = exception.getStatus();

		// 记录错误日志
		this.logger.error({
			message: exception.message,
			stack: exception.stack,
		});

		response.status(status).json({
			code: status,
			timestamp: new Date().toLocaleString('zh-CN'),
			path: request.url,
			method: request.method,
			message: exception.message || HttpException.name,
		});
	}
}
