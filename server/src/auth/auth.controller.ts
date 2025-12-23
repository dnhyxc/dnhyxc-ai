import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDTO } from './dto/login-user.dto';

@Controller('auth')
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
	register(@Body() dto: LoginUserDTO) {
		const { username, password } = dto;
		return this.authService.register(username, password);
	}
}
