import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Cache } from 'cache-manager';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigEnum } from '../../enum/config.enum';

export const wechatUnbindCacheKey = (userId: number) =>
	`wechat-unbind:${userId}`;

// 自动校验 JWT 策略
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
	constructor(
		protected configService: ConfigService,
		@Inject(CACHE_MANAGER) private readonly cache: Cache,
	) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>(ConfigEnum.SECRET)!,
		});
	}

	async validate(payload: { sub: number; username: string; wechat?: boolean }) {
		if (payload.wechat) {
			const revoked = await this.cache.get(wechatUnbindCacheKey(payload.sub));
			if (revoked) {
				throw new UnauthorizedException('微信关联已解除，请重新登录');
			}
		}

		return {
			userId: payload.sub,
			username: payload.username,
		};
	}
}
