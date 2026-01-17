import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigEnum } from '../../enum/config.enum';

// 自动校验 JWT 策略
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
	// protected 成员在类内部及其子类中可访问，private 成员仅在当前类内部可访问。
	constructor(protected configService: ConfigService) {
		super({
			// 告诉 Passport 从 HTTP 请求头的 Authorization 字段中提取 JWT，
			// 并期望格式为 "Bearer <token>"，即标准的 Bearer Token 方式
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			// 如果设为 true，Passport 会忽略 token 的过期时间（exp 字段），
			// 这里设为 false，表示一旦 token 过期就立即拒绝请求，保证安全性
			ignoreExpiration: false,
			// 用于验证 JWT 签名的密钥（secret 或 public key），
			// 必须与签发时使用的密钥一致，否则无法通过验证。
			// 从配置中心读取，使用非空断言（!）确保运行时一定有值
			secretOrKey: configService.get<string>(ConfigEnum.SECRET)!,
		});
	}
	/**
	 * Passport 在成功验证 JWT 签名并解码出 payload 后，
	 * 会自动调用 validate() 方法，并将解码后的 payload 传入。
	 * 该方法的返回值会被挂载到 req.user，供后续中间件或控制器使用。
	 *
	 * @param payload JWT 解码后的载荷对象，通常包含 sub、username、iat、exp 等字段
	 * @returns 返回一个对象，其属性将被附加到 req.user 上，
	 * 这里提取 payload.sub 作为 userId，payload.username 作为 username
	 */
	async validate(payload) {
		// 将 payload 中的关键字段映射为业务层更易理解的字段名
		return {
			userId: payload.sub, // sub (subject) 一般存储用户唯一标识
			username: payload.username, // username 存储用户名
		};
	}
}
