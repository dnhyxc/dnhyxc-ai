import { randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MailerService } from '@nestjs-modules/mailer';
// import * as argon2 from 'argon2';
import * as svgCaptcha from 'svg-captcha';
import { EmailEnum } from '../../enum/config.enum';
import { comparePassword, randomLightColor } from '../../utils';
import { UserService } from '../user/user.service';
import { CaptchaDto } from './dto/captcha.dto';
import { EmailOptionsDTO } from './dto/email.dto';
import { LoginUserDTO } from './dto/login-user.dto';
import { RegisterUserDTO } from './dto/register-user.dto';

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private jwt: JwtService,
		private cache: Cache,
		private mailerService: MailerService,
		private configService: ConfigService,
	) {}
	async login(dto: LoginUserDTO) {
		const { username, password, captchaId, captchaText } = dto;
		const isCaptchaValid = await this.verifyCaptcha(captchaId, captchaText);
		if (!isCaptchaValid) {
			throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
		}
		const user = await this.userService.findByUsername(username);
		if (!user) {
			throw new HttpException(
				'用户不存在，请先前往注册',
				HttpStatus.BAD_REQUEST,
			);
		}
		// 使用 argon2 验证密码
		// const isPasswordValid = await argon2.verify(user.password, password);
		const isPasswordValid = await comparePassword(password, user.password);
		if (isPasswordValid) {
			const { password, ...userInfo } = user; // 使用解构赋值排除password
			const token = await this.jwt.signAsync(
				{
					username: userInfo.username,
					sub: userInfo.id,
				},
				// 局部设置 token 过期时间，一般用在 refreshToken 上
				// {
				// 	expiresIn: '1d',
				// },
			);
			// 返回根据用户的用户名及密码生成的 token
			return {
				access_token: token,
				...userInfo,
			};
		} else {
			throw new HttpException('用户名或密码错误', HttpStatus.BAD_REQUEST);
		}
	}

	async register(dto: RegisterUserDTO) {
		const verify = await this.verifyEmail(dto.verifyCodeKey, dto.verifyCode);
		if (!verify) {
			throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
		}
		const user = await this.userService.findByUsername(dto.username);
		if (user) {
			throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST);
		}
		return await this.userService.create({
			username: dto.username,
			password: dto.password,
			email: dto.email,
		});
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
			throw new HttpException(
				'验证码已过期，请重新获取',
				HttpStatus.BAD_REQUEST, // 400
			);
		}
		if (
			captchaTextInCache &&
			(captchaTextInCache as string).toLowerCase() === captchaText.toLowerCase()
		) {
			return true;
		} else {
			throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
		}
	}

	async sendEmail(to: string, options?: EmailOptionsDTO) {
		const key = options?.key || 'EMAIL';
		const timeout = options?.timeout || 60 * 1000;
		try {
			const code = Math.floor(100000 + Math.random() * 900000).toString();
			await this.mailerService.sendMail({
				to,
				from: `"dnhyxc-ai" <${this.configService.get(EmailEnum.EMAIL_FROM)}>`,
				subject: options?.subject || '注册验证码',
				html: `
					<div>
						<h1>${options?.title || '欢迎注册 dnhyxc-ai'}</h1>
						<h3>接收验证码</h3>
						<p>验证码：<span style="font-size: 20px;">${code}</span></p>
						<p style="font-size: 14px;">此验证码只在 ${timeout / (60 * 1000)} 分钟内有效，请尽快使用，同时请勿泄露给其他人。</p>
					</div>
				`,
				// template: 'mail',
				// context: {
				// 	code,
				// },
			});
			const REDIS_KEY = `${key}_${randomUUID()}_${to}`;
			await this.cache.set(REDIS_KEY, code, timeout);
			return {
				key: REDIS_KEY,
			};
		} catch (error) {
			throw new HttpException(
				error?.message || '发送邮件失败',
				HttpStatus.BAD_REQUEST,
			);
		}
	}

	async verifyEmail(verifyCodeKey: string, verifyCode: number) {
		const codeInCache = await this.cache.get(verifyCodeKey);
		if (!codeInCache) {
			throw new HttpException(
				'验证码已过期，请重新获取',
				HttpStatus.BAD_REQUEST, // 400
			);
		}
		if (codeInCache && Number(codeInCache) === Number(verifyCode)) {
			return true;
		} else {
			throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
		}
	}
}
