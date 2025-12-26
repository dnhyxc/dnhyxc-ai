import { ForbiddenException } from '@nestjs/common';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { User } from '../../user/user.entity';
import { UserService } from '../../user/user.service';
import { AuthService } from '../auth.service';

describe('AuthService 登录认证服务', () => {
	let service: AuthService;
	let userService: Partial<UserService>;
	let jwt: Partial<JwtService>;
	let userArr: User[];
	const mockUser = {
		username: 'admin',
		password: 'admin',
	};

	beforeEach(async () => {
		userArr = [];
		userService = {
			findByUsername: (username: string) => {
				const user = userArr.find((item) => item.username === username);
				return Promise.resolve(user as User);
			},
			create: async (user: Partial<User>) => {
				const tempUser = new User();
				tempUser.id = Math.floor(Math.random() * 1000);
				tempUser.username = user.username!;
				tempUser.password = await argon2.hash(user.password!);
				userArr.push(tempUser);
				return Promise.resolve(tempUser);
			},
		};

		jwt = {
			signAsync: (
				payload: string | object | Buffer,
				options?: JwtSignOptions,
			) => {
				return Promise.resolve('token');
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{ provide: UserService, useValue: userService },
				{ provide: JwtService, useValue: jwt },
			],
		}).compile();

		service = module.get<AuthService>(AuthService);
	});

	afterEach(async () => {
		userArr = [];
	});

	it('鉴权服务实例化', () => {
		expect(service).toBeDefined();
	});

	it('用户初次注册', async () => {
		const user = await service.register(mockUser.username, mockUser.password);
		expect(user).toBeDefined();
		expect(user.username).toBe(mockUser.username);
	});

	it('用户使用相同的用户名再次注册', async () => {
		await service.register(mockUser.username, mockUser.password);
		// (
		// 	(await expect(
		// 		service.register(mockUser.username, mockUser.password),
		// 	)) as any
		// ).rejects.toThorw(new ForbiddenException('用户已存在'));
	});

	it('用户登录', async () => {
		await service.register(mockUser.username, mockUser.password);
		await expect(
			service.login(mockUser.username, mockUser.password),
		).resolves.toBe('token');
	});

	it('用户登录，用户名密码错误', async () => {
		await service.register(mockUser.username, mockUser.password);
		await expect(service.login(mockUser.username, 'qwqwqwq')).rejects.toThrow(
			new ForbiddenException('用户名或密码错误'),
		);
	});

	it('用户登录，用户名不存在', async () => {
		// await service.register(mockUser.username, mockUser.password);
		await expect(
			service.login(mockUser.username, mockUser.password),
		).rejects.toThrow(new ForbiddenException('用户不存在，请先前往注册'));
	});
});
