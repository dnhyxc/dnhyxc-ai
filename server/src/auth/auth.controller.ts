import {
	Body,
	ClassSerializerInterceptor,
	Controller,
	Post,
	UseInterceptors,
} from '@nestjs/common';
// import { SerializeInterceptor } from '../interceptors/serialize.interceptor';
import { AuthService } from './auth.service';
import { LoginUserDTO } from './dto/login-user.dto';

@Controller('auth')
// 使用 ClassSerializerInterceptor 拦截器 将 entry.ts 中通过 Exclude() 注解的属性过滤掉
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
	constructor(private authService: AuthService) {}

	@Post('/login')
	async login(@Body() dto: LoginUserDTO) {
		const { username, password } = dto;
		const token = await this.authService.login(username, password);
		return {
			access_token: token,
		};
	}

	@Post('/register')
	// @UseInterceptors(SerializeInterceptor)
	register(@Body() dto: LoginUserDTO) {
		const { username, password } = dto;
		return this.authService.register(username, password);
	}
}
