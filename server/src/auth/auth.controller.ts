import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Post,
	UseInterceptors,
} from '@nestjs/common';
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
	async sendEmail(@Body('email') email: string) {
		return await this.authService.sendEmail(email);
	}
}
