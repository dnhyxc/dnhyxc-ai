import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private jwt: JwtService,
	) {}
	async login(username: string, password: string) {
		const user = await this.userService.findByUsername(username);
		if (user && user.password === password) {
			// 生成 token
			return await this.jwt.signAsync(
				{
					username: user.username,
					sub: user.id,
				},
				// 局部设置 token 过期时间，一般用在 refreshToken 上
				// {
				// 	expiresIn: '1d',
				// },
			);
		}

		throw new UnauthorizedException('用户不存在');
	}
	async register(username: string, password: string) {
		const res = await this.userService.create({
			username,
			password,
		});
		return res;
	}
}
