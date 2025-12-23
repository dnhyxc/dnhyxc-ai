import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDTO } from './dto/login-user.dto';

@Controller('auth')
export class AuthController {
	constructor(private authService: AuthService) {}

	@Post('/login')
	login(@Body() dto: LoginUserDTO) {
		console.log('dto', dto);
		const { username, password } = dto;
		return this.authService.login(username, password);
	}

	@Post('/register')
	register(@Body() dto: LoginUserDTO) {
		const { username, password } = dto;
		return this.authService.register(username, password);
	}
}
