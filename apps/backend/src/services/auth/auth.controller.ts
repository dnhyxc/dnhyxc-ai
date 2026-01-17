import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	HttpException,
	HttpStatus,
	NotAcceptableException,
	Post,
	UseInterceptors,
} from '@nestjs/common';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import {
	SendResetPasswordEmailDTO,
	UpdatePasswordDTO,
} from '../user/dto/update-user.dto';
import { SwaggerUpdateUser } from '../user/user.swagger';
import { AuthService } from './auth.service';
import { CaptchaDto } from './dto/captcha.dto';
import { EmailOptionsDTO } from './dto/email.dto';
import { LoginUserDTO } from './dto/login-user.dto';
import { RegisterUserDTO } from './dto/register-user.dto';

@Controller('auth')
// 使用 ClassSerializerInterceptor 拦截器 将 entry.ts 中通过 Exclude() 注解的属性过滤掉
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
// @UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
	constructor(private authService: AuthService) {}

	@Post('/login')
	async login(@Body() dto: LoginUserDTO) {
		return await this.authService.login(dto);
	}

	@Post('/register')
	// @UseInterceptors(SerializeInterceptor)
	async register(@Body() dto: RegisterUserDTO) {
		return await this.authService.register(dto);
	}

	@Post('/createVerifyCode')
	async createVerifyCode(@Body() dto: CaptchaDto) {
		return await this.authService.createVerifyCode(dto);
	}

	@Post('/sendEmail')
	async sendEmail(
		@Body('email') email: string,
		@Body('options') options?: EmailOptionsDTO,
	) {
		return await this.authService.sendEmail(email, options);
	}

	@Post('/sendResetPwdEmail')
	@SwaggerUpdateUser()
	async sendResetPwdEmail(@Body() dto: SendResetPasswordEmailDTO) {
		// 使用 jwt Passport 向 req 上添加的 user 信息，对比较用户 id，如果不是本人将无法修改信息
		const res = await this.authService.sendResetPwdEmail({
			username: dto.username,
			email: dto.email,
		});
		if (res) {
			return res;
		} else {
			throw new NotAcceptableException('邮箱发送失败');
		}
	}

	@Post('/resetPassword')
	@SwaggerUpdateUser()
	async resetPassword(@Body() dto: UpdatePasswordDTO) {
		// 使用 jwt Passport 向 req 上添加的 user 信息，对比较用户 id，如果不是本人将无法修改信息
		const verify = await this.authService.verifyEmail(
			dto.verifyCodeKey,
			dto.verifyCode,
		);
		if (!verify) {
			throw new HttpException('邮箱验证码错误', HttpStatus.BAD_REQUEST);
		}
		const res = await this.authService.resetPassword(dto);
		if (res) {
			return res;
		} else {
			throw new NotAcceptableException('邮箱更新失败');
		}
	}
}
