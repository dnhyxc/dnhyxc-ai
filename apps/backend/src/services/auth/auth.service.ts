import { createHash, randomUUID } from 'node:crypto';
import { Cache } from '@nestjs/cache-manager';
import {
	Body,
	HttpException,
	HttpStatus,
	Injectable,
	Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { MailerService } from '@nestjs-modules/mailer';
// import * as argon2 from 'argon2';
import * as svgCaptcha from 'svg-captcha';
import { Repository } from 'typeorm';
import { EmailEnum } from '../../enum/config.enum';
import { comparePassword, randomLightColor } from '../../utils';
import {
	SendResetPasswordEmailDTO,
	UpdatePasswordDTO,
} from '../user/dto/update-user.dto';
import { UserService } from '../user/user.service';
import { SwaggerUpdateUser } from '../user/user.swagger';
import { CaptchaDto } from './dto/captcha.dto';
import { EmailOptionsDTO } from './dto/email.dto';
import { LoginByEmailDTO, LoginUserDTO } from './dto/login-user.dto';
import { RegisterUserDTO } from './dto/register-user.dto';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { UserWechat } from './wechat/user-wechat.entity';
import { WechatMiniProgramService } from './wechat/wechat-mini-program.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private jwt: JwtService,
		private cache: Cache,
		private mailerService: MailerService,
		private configService: ConfigService,
		private wechatMiniProgramService: WechatMiniProgramService,
		@InjectRepository(UserWechat)
		private readonly userWechatRepo: Repository<UserWechat>,
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
		const isPasswordValid = await comparePassword(password, user.password);
		if (isPasswordValid) {
			const { password, ...userInfo } = user;
			const token = await this.jwt.signAsync({
				username: userInfo.username,
				sub: userInfo.id,
			});
			return { access_token: token, ...userInfo };
		}
		throw new HttpException('用户名或密码错误', HttpStatus.BAD_REQUEST);
	}

	async loginByWechat(dto: WechatLoginDto) {
		if (dto.scene !== 'mini_program') {
			throw new HttpException('暂仅支持小程序登录', HttpStatus.BAD_REQUEST);
		}
		const { openid, unionid } =
			await this.wechatMiniProgramService.code2Session(dto.code);
		const appid = this.wechatMiniProgramService.getAppId();
		let mapping = await this.userWechatRepo.findOne({
			where: { scene: dto.scene, appid, openid },
		});
		let user =
			mapping != null ? await this.userService.findOne(mapping.userId) : null;
		if (!user) {
			const suffix = createHash('sha256')
				.update(openid)
				.digest('hex')
				.slice(0, 12);
			user = await this.userService.create({
				username: `wx_${suffix}`,
				email: `wx_${suffix}@wx.local`,
				password: randomUUID(),
			});
			mapping = this.userWechatRepo.create({
				userId: user.id,
				scene: dto.scene,
				appid,
				openid,
				unionid: unionid ?? null,
			});
		}
		mapping!.lastLoginAt = new Date();
		await this.userWechatRepo.save(mapping!);
		const { password, ...userInfo } = user;
		const token = await this.jwt.signAsync({
			username: userInfo.username,
			sub: userInfo.id,
		});
		return { access_token: token, ...userInfo };
	}

	async loginByEmail(dto: LoginByEmailDTO) {
		const { email, verifyCodeKey, verifyCode } = dto;
		const user = await this.userService.findByEmail(email);
		if (!user) {
			throw new HttpException(
				'用户不存在，请先前往注册',
				HttpStatus.BAD_REQUEST,
			);
		}
		const vertifyEmailCode = await this.verifyEmail(verifyCodeKey, verifyCode);
		if (vertifyEmailCode) {
			const { password, ...userInfo } = user; // 使用解构赋值排除password
			const token = await this.jwt.signAsync({
				username: userInfo.username,
				sub: userInfo.id,
			});
			// 返回根据用户的用户名及密码生成的 token
			return {
				access_token: token,
				...userInfo,
			};
		} else {
			throw new HttpException('邮箱或邮箱验证码错误', HttpStatus.BAD_REQUEST);
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

	@Post('/sendResetPwdEmail')
	@SwaggerUpdateUser()
	async sendResetPwdEmail(@Body() dto: Partial<SendResetPasswordEmailDTO>) {
		const _user = await this.userService.findByUsername(dto.username!);
		if (!_user) {
			throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
		}
		if (_user.email !== dto.email) {
			throw new HttpException('当前用户未绑定该邮箱', HttpStatus.BAD_REQUEST);
		}
		return this.sendEmail(dto.email, {
			subject: '重置密码',
			title: '重置用户密码',
			key: dto.key || 'RESET_PASSWORD',
			timeout: dto.timeout || 120 * 1000,
		});
	}

	async resetPassword(user: UpdatePasswordDTO) {
		const _user = await this.userService.findByUsername(user.username);
		if (!_user) {
			throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
		}
		if (_user.email !== user.email) {
			throw new HttpException('邮箱不匹配', HttpStatus.BAD_REQUEST);
		}
		const isPasswordValid = await comparePassword(
			user.password,
			_user.password,
		);
		if (isPasswordValid) {
			throw new HttpException('新密码与原始密码相同', HttpStatus.BAD_REQUEST);
		}
		const verify = await this.verifyEmail(user.verifyCodeKey, user.verifyCode);
		if (!verify) {
			throw new HttpException('验证码错误', HttpStatus.BAD_REQUEST);
		}
		return this.userService.resetPassword(user, _user);
	}
}
