import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import { HttpException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as svgCaptcha from 'svg-captcha';
import { UserService } from '../user/user.service';
import { randomLightColor } from '../utils';
import { CaptchaDto } from './dto/captcha.dto';
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
		if (!isCaptchaValid) throw new HttpException('验证码错误', 500);
		const user = await this.userService.findByUsername(username);
		if (!user) {
			throw new HttpException('用户不存在，请先前往注册', 500);
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
			throw new HttpException('用户名或密码错误', 500);
		}
	}
	async register(username: string, password: string) {
		const user = await this.userService.findByUsername(username);
		if (user) {
			throw new HttpException('用户已存在', 500);
		} else {
			return await this.userService.create({
				username,
				password,
			});
		}
	}

	async createVerifyCode(dto?: CaptchaDto) {
		const {
			size = 4,
			width = 120,
			height = 36,
			fontSize = 50,
			noise = 3,
			background = randomLightColor(),
		} = dto || {};
		const captcha = svgCaptcha.create({
			size,
			fontSize,
			width,
			height,
			background,
			noise,
			ignoreChars: '0o1i',
			color: true,
			mathMin: 1,
			mathMax: 9,
			mathOperator: '+',
			inverse: true,
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
		if (!captchaTextInCache) {
			throw new HttpException('验证码已过期，请重新获取', 500);
		}
		if (
			captchaTextInCache &&
			(captchaTextInCache as string).toLowerCase() === captchaText.toLowerCase()
		) {
			return true;
		} else {
			throw new HttpException('验证码错误', 500);
		}
	}
}
