import { Test, TestingModule } from '@nestjs/testing';
import { User } from '../../../user/user.entity';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { LoginUserDTO } from '../dto/login-user.dto';

describe('AuthController', () => {
	let controller: AuthController;
	let mockAuthService: Partial<AuthService>;

	beforeEach(async () => {
		mockAuthService = {
			login: (dto: LoginUserDTO) => {
				if (dto.username && dto.password) {
					return Promise.resolve('token');
				} else {
					return Promise.reject('error');
				}
			},
			register: (username: string, password: string) => {
				const user = new User();
				user.username = username;
				user.password = password;
				return Promise.resolve(user);
			},
		};

		const module: TestingModule = await Test.createTestingModule({
			controllers: [AuthController],
			providers: [
				{
					provide: AuthService,
					useValue: mockAuthService,
				},
			],
		}).compile();

		controller = module.get<AuthController>(AuthController);
	});

	it('鉴权实例化', () => {
		expect(controller).toBeDefined();
	});

	it('login 登录', async () => {
		const res = controller.login({
			username: 'admin',
			password: 'admin',
		} as LoginUserDTO);
		expect(await res).not.toBeNull();
		expect((await res).access_token).toBe('token');
	});

	it('register 注册', async () => {
		const res = controller.register({
			username: 'admin',
			password: 'admin',
		} as LoginUserDTO);
		expect(await res).not.toBeNull();
		expect((await res).data.id).not.toBeNull();
		expect((await res) instanceof User).toBeTruthy();
		expect((await res).data.username).toBe('admin');
		expect((await res).data.password).toBe('admin');
	});
});
