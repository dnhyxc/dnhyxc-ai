import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigEnum } from '../enum/config.enum';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	// protected 成员在类内部及其子类中可访问，private 成员仅在当前类内部可访问。
	constructor(protected configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get<string>(ConfigEnum.SECRET)!,
		});
	}

	async validate(payload: any) {
		// 会自动将 payload.sub、payload.username 加到 req.user 上
		return {
			userId: payload.sub,
			username: payload.username,
		};
	}
}
