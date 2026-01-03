import { randomUUID } from 'node:crypto';
import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	HttpException,
	HttpStatus,
	Post,
	UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailEnum } from '../enum/config.enum';
import { ResponseInterceptor } from '../interceptors/response.interceptor';
import { AuthService } from './auth.service';
import { CaptchaDto } from './dto/captcha.dto';
import { LoginUserDTO } from './dto/login-user.dto';
import { RegisterUserDTO } from './dto/register-user.dto';

@Controller('auth')
// 使用 ClassSerializerInterceptor 拦截器 将 entry.ts 中通过 Exclude() 注解的属性过滤掉
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
// @UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
	constructor(
		private authService: AuthService,
		private mailerService: MailerService,
		private configService: ConfigService,
	) {}

	@Post('/login')
	async login(@Body() dto: LoginUserDTO) {
		const res = await this.authService.login(dto);
		return {
			access_token: res,
		};
	}

	@Post('/register')
	// @UseInterceptors(SerializeInterceptor)
	async register(@Body() dto: RegisterUserDTO) {
		const { username, password } = dto;
		return await this.authService.register(username, password);
	}

	@Post('/createVerifyCode')
	async createVerifyCode(@Body() dto: CaptchaDto) {
		return await this.authService.createVerifyCode(dto);
	}

	@Post('/email')
	async sendEmail(@Body('email') email: string) {
		try {
			const code = randomUUID().substring(0, 6);
			const res = await this.mailerService.sendMail({
				to: email,
				from: `"dnhyxc-ai" <${this.configService.get(EmailEnum.EMAIL_FROM)}>`,
				subject: '注册验证码',
				template: 'mail',
				context: {
					code,
				},
			});
			return res.envelope;
		} catch (error) {
			throw new HttpException(
				error?.message || '发送邮件失败',
				HttpStatus.BAD_REQUEST,
			);
		}
	}
}
