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
	intercept(
		_context: ExecutionContext,
		next: CallHandler,
	): Observable<Data<T>> {
		// const req = context.switchToHttp().getRequest();
		// 这会在拦截器之前执行
		return next.handle().pipe(
			map((data) => {
				// 这里会在拦截器之后执行
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
