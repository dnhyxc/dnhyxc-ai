import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	HttpStatus,
	Post,
	UseInterceptors,
} from '@nestjs/common';
// import { SerializeInterceptor } from '../interceptors/serialize.interceptor';
import { AuthService } from './auth.service';
import { CaptchaDto } from './dto/captcha.dto';
import { LoginUserDTO } from './dto/login-user.dto';
import { RegisterUserDTO } from './dto/register-user.dto';

@Controller('auth')
// 使用 ClassSerializerInterceptor 拦截器 将 entry.ts 中通过 Exclude() 注解的属性过滤掉
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
	constructor(private authService: AuthService) {}

	@Post('/login')
	async login(@Body() dto: LoginUserDTO) {
		const token = await this.authService.login(dto);
		return {
			access_token: token,
			success: true,
			message: '登录成功',
			code: HttpStatus.OK,
		};
	}

	@Post('/register')
	// @UseInterceptors(SerializeInterceptor)
	async register(@Body() dto: RegisterUserDTO) {
		const { username, password } = dto;
		const res = await this.authService.register(username, password);
		return {
			success: true,
			message: '注册成功',
			data: res,
			code: HttpStatus.OK,
		};
	}

	@Post('/createVerifyCode')
	async createVerifyCode(@Body() dto: CaptchaDto) {
		const data = await this.authService.createVerifyCode(dto);
		if (data) {
			return {
				data: {
					captcha: data.captcha,
					captchaId: data.captchaId,
				},
				code: HttpStatus.OK,
				success: true,
				message: '获取验证码成功',
			};
		} else {
			return {
				code: HttpStatus.INTERNAL_SERVER_ERROR,
				success: false,
				message: '获取验证码失败',
			};
		}
	}
}
