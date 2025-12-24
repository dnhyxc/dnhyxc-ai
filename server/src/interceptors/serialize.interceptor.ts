import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
	intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
		// const req = context.switchToHttp().getRequest();
		// 这会在拦截器之前执行
		return next.handle().pipe(
			map((data) => {
				// 这里会在拦截器之后执行
				return data;
			}),
		);
	}
}
