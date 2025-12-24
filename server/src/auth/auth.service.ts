import { ForbiddenException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthService {
	constructor(
		private readonly userService: UserService,
		private jwt: JwtService,
	) {}
	async login(username: string, password: string) {
		const user = await this.userService.findByUsername(username);
		if (!user) {
			throw new ForbiddenException('用户不存在，请先前往注册');
		}
		// 使用 argon2 验证密码
		const isPasswordValid = await argon2.verify(user.password, password);
		if (isPasswordValid) {
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
		} else {
			throw new ForbiddenException('用户名或密码错误');
		}
	}
	async register(username: string, password: string) {
		const user = await this.userService.findByUsername(username);
		if (user) {
			throw new ForbiddenException('用户已存在');
		} else {
			return await this.userService.create({
				username,
				password,
			});
		}
	}
}
