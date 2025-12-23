// typeorm.filter.ts 模块，用户专门检测数据库错误

import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { QueryFailedError, TypeORMError } from 'typeorm';

@Catch()
export class TypeormFilter implements ExceptionFilter {
	catch(exception: TypeORMError, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse();

		let code = 500;

		if (exception instanceof QueryFailedError) {
			code = exception.driverError?.errno;
		}

		const error =
			code === 1062 ? '数据库唯一约束冲突，记录重复' : exception.message;

		response.status(500).json({
			code,
			timestamp: new Date().toLocaleString('zh-CN'),
			error,
			message: exception.message,
		});
	}
}
