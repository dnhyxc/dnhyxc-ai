import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Post,
	UseInterceptors,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
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
	@ApiOperation({ summary: '用户登录', description: '用户登录接口' })
	async login(@Body() dto: LoginUserDTO) {
		return await this.authService.login(dto);
	}

	@Post('/register')
	@ApiOperation({ summary: '用户注册', description: '用户注册接口' })
	// @UseInterceptors(SerializeInterceptor)
	async register(@Body() dto: RegisterUserDTO) {
		const { username, password } = dto;
		return await this.authService.register(username, password);
	}

	@Post('/createVerifyCode')
	@ApiOperation({ summary: '获取验证码', description: '获取验证码接口' })
	async createVerifyCode(@Body() dto: CaptchaDto) {
		return await this.authService.createVerifyCode(dto);
	}
}
