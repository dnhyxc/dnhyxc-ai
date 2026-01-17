import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export class JwtGuard extends AuthGuard('jwt') {
	// 这里如果不写 constructor super，默认会调用 super()
	// constructor() {
	// 	super();
	// }

	handleRequest(err: any, user: any) {
		if (err || !user) {
			// 这里直接抛出异常，由全局过滤器处理
			throw new UnauthorizedException('请先登录后再试');
		}
		return user;
	}
}
