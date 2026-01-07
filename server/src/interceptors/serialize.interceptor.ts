import {
	CallHandler,
	ExecutionContext,
	Injectable,
	NestInterceptor,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { map, Observable } from 'rxjs';

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
	constructor(private readonly dto: any) {}
	intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
		// const req = context.switchToHttp().getRequest();
		// 这会在拦截器之前执行
		return next.handle().pipe(
			map((data) => {
				// 这里会在拦截器之后执行
				return plainToInstance(this.dto, data, {
					/**
					 * 设置完 excludeExtraneousValues: true 后，所有经过 interceptor 的接口都需要设置 Expose 或 Exclude
					 * Expose 表示当前字段需要暴露，Exclude 表示当前字段不需要暴露
					 */
					excludeExtraneousValues: true,
					// 开启隐式类型转换，将普通对象中的基本类型（如字符串、数字）自动转为 DTO 中装饰器声明的类型
					// enableImplicitConversion: true,
				});
			}),
		);
	}
}
