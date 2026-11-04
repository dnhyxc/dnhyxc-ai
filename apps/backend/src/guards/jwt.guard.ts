import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

export class JwtGuard extends AuthGuard('jwt') {
	// 保留 validate 抛出的原文案（踢下线 / 微信解绑），其余统一「请先登录」
	handleRequest(err: any, user: any) {
		if (err instanceof UnauthorizedException) {
			throw err;
		}
		if (err || !user) {
			throw new UnauthorizedException('请先登录后再试');
		}
		return user;
	}
}
