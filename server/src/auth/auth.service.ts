import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import { HttpException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as svgCaptcha from 'svg-captcha';
import { UserService } from '../user/user.service';
import { LoginUserDTO } from './dto/login-user.dto';

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private jwt: JwtService,
		private cache: Cache,
	) {}
	async login(dto: LoginUserDTO) {
		const { username, password, captchaId, captchaText } = dto;
		const isCaptchaValid = await this.verifyCaptcha(captchaId, captchaText);
		if (!isCaptchaValid) throw new HttpException('验证码错误', 200);
		const user = await this.userService.findByUsername(username);
		if (!user) {
			throw new HttpException('用户不存在，请先前往注册', 200);
		}
		// 使用 argon2 验证密码
		const isPasswordValid = await argon2.verify(user.password, password);
		if (isPasswordValid) {
			return await this.jwt.signAsync(
				{
					username: user.username,
					sub: user.id,
				},
				// 局部设置 token 过期时间，一般用在 refreshToken 上
				// {
				// 	expiresIn: '1d',
				// },
			);
		} else {
			throw new HttpException('用户名或密码错误', 200);
		}
	}
	async register(username: string, password: string) {
		const user = await this.userService.findByUsername(username);
		if (user) {
			throw new HttpException('用户已存在', 200);
		} else {
			return await this.userService.create({
				username,
				password,
			});
		}
	}

	async getCaptcha() {
		const captcha = svgCaptcha.create({
			size: 4,
			fontSize: 32,
			width: 100,
			height: 36,
			background: '#cc9966',
		});
		const REDIS_KEY = `Captcha_Text_${randomUUID()}`;
		// 设置验证码缓存，30 秒后自动过期并清除
		await this.cache.set(REDIS_KEY, captcha.text, 120 * 1000);
		return {
			captcha: captcha.data,
			captchaId: REDIS_KEY,
		};
	}

	// 从 redis 中取出验证码与登录时传递的验证码进行比对
	async verifyCaptcha(captchaId: string, captchaText: string) {
		const captchaTextInCache = await this.cache.get(captchaId);
		if (
			captchaTextInCache &&
			(captchaTextInCache as string).toLowerCase() === captchaText.toLowerCase()
		) {
			return true;
		}
		throw new HttpException('验证码已过期，请重新获取', 200);
	}
}
