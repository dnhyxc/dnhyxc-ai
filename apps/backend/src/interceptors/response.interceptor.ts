import {
	CallHandler,
	ExecutionContext,
	HttpStatus,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface Data<T> {
	data: T;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor {
	constructor() {}
	intercept(context: ExecutionContext, next: CallHandler): Observable<Data<T>> {
		const httpRes = context.switchToHttp().getResponse<{
			headersSent?: boolean;
			writableEnded?: boolean;
		}>();
		return next.handle().pipe(
			map((data) => {
				// @Res() 已写完二进制（如 DOCX）时勿再包一层 JSON
				if (httpRes?.headersSent || httpRes?.writableEnded) {
					return data as Data<T>;
				}
				return {
					data,
					code: HttpStatus.OK,
					message: '请求成功',
					success: true,
				};
			}),
		);
	}
}
