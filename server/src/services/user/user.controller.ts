import {
	BadRequestException,
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
	HttpException,
	HttpStatus,
	NotAcceptableException,
	NotFoundException,
	Param,
	ParseIntPipe,
	Post,
	Query,
	Req,
	UnauthorizedException,
	UseGuards,
	UseInterceptors,
} from '@nestjs/common';
// import { TypeormFilter } from '../filters/typeorm.filter';
// import { AdminGuard } from '../guards/admin.guard';
import { JwtGuard } from '../../guards/jwt.guard';
import { ResponseInterceptor } from '../../interceptors/response.interceptor';
import { AuthService } from '../auth/auth.service';
import { CreateUserDTO } from './dto/create-user.dto';
import { GetUserDto } from './dto/get-user.dto';
import { UpdateEmailDTO, UpdateUserDTO } from './dto/update-user.dto';
import { CreateUserPipe } from './pipes/create-user.pipe';
import { User } from './user.entity';
import { UserService } from './user.service';
import {
	SwaggerAddUser,
	SwaggerController,
	SwaggerDeleteUser,
	SwaggerGetLogsByGroup,
	SwaggerGetUserById,
	SwaggerGetUserLogs,
	SwaggerGetUserProfile,
	SwaggerGetUsers,
	SwaggerUpdateUser,
} from './user.swagger';

@Controller('user')
@SwaggerController()
// TODO: 添加 TypeormFilter 异常过滤器，目前这会导致 DOT 报错不能正常响应，要使用的话，后续需要优化，目前直接使用全局错误响应过滤器
// @UseFilters(new TypeormFilter())
// 添加 JwtGuard 守卫
@UseGuards(JwtGuard)
// ClassSerializerInterceptor 设置返回字段过滤，ResponseInterceptor 设置响应拦截器，统一响应的格式
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
export class UserController {
	constructor(
		private readonly userService: UserService,
		private readonly authService: AuthService,
	) {}

	@Post('/addUser')
	@SwaggerAddUser() // 使用提取的装饰器
	// 使用 CreateUserPipe 管道，对接收的参数进行处理
	addUser(@Body(CreateUserPipe) user: CreateUserDTO) {
		return this.userService.create(user as User);
	}

	@Get('/getUsers')
	@SwaggerGetUsers()
	/**
	 * 1. 装饰器的执行顺序：方法的装饰器如果有多个，则是从下往上执行。
	 * @UserGuards(AdminGuard) 后执行
	 * @UseGuards(AuthGuard('jwt')) 先执行
	 * 2. 如果使用 UserGuards 传递多个守卫，则是从前往后执行，如果前面的 Guard 没有通过，泽后面的 Guard 不会执行。
	 * 3. 只有先使用 AuthGuard('jwt') 之后，才会触发 Passport 将 user 信息添加到 req 上。否则在 AdminGuard 中将无法获取到 user 信息
	 */
	// @UseGuards(AdminGuard)
	getUsers(@Query() query: GetUserDto) {
		return this.userService.findAll(query);
	}

	@Get('/getUserById/:id')
	@SwaggerGetUserById()
	getUserById(@Param('id', ParseIntPipe) id: number) {
		return this.userService.findOne(id);
	}

	@Post('/updateUser')
	@SwaggerUpdateUser()
	async updateUser(
		@Body() user: UpdateUserDTO,
		// @Param('id', ParseIntPipe) id: number,
		@Req() req,
	) {
		// 使用 jwt Passport 向 req 上添加的 user 信息，对比较用户 id，如果不是本人将无法修改信息
		if (req.user?.userId === user.id) {
			const res = await this.userService.update(user.id, user);
			if (res) {
				return res;
			} else {
				throw new NotAcceptableException('用户信息更新失败');
			}
		} else {
			throw new UnauthorizedException('暂无权限');
		}
	}

	@Post('/updateEmail')
	@SwaggerUpdateUser()
	async updateEmail(@Body() dto: UpdateEmailDTO, @Req() req) {
		// 使用 jwt Passport 向 req 上添加的 user 信息，对比较用户 id，如果不是本人将无法修改信息
		if (req.user?.userId === dto.id) {
			const verify = await this.authService.verifyEmail(
				dto.oldVerifyCodeKey,
				dto.oldVerifyCode,
			);
			if (!verify) {
				throw new HttpException('原邮箱验证码错误', HttpStatus.BAD_REQUEST);
			}
			const newVerify = await this.authService.verifyEmail(
				dto.newVerifyCodeKey,
				dto.newVerifyCode,
			);
			if (!newVerify) {
				throw new HttpException('新邮箱验证码错误', HttpStatus.BAD_REQUEST);
			}
			const res = await this.userService.updateEmail(dto.id, dto.email);
			if (res) {
				return res;
			} else {
				throw new NotAcceptableException('邮箱更新失败');
			}
		} else {
			throw new UnauthorizedException('暂无权限');
		}
	}

	@Delete('deleteUser/:id')
	@SwaggerDeleteUser()
	async removeUser(@Param('id', ParseIntPipe) id: number) {
		if (!id) throw new BadRequestException('id is required');
		const res = await this.userService.remove(id);
		if (res) {
			return res;
		} else {
			throw new NotFoundException('删除的用户不存在');
		}
	}

	// ParseIntPipe 将参数转换成数字
	@Get('/profile')
	@SwaggerGetUserProfile()
	getUserProfile(
		@Query('id', ParseIntPipe) id: number,
		// 这里 req 中的 user 是通过 AuthGuard('jwt) 中的 validate 方法返回的
		// 是通过 PassportModule 自动添加的
		// @Req() req,
	) {
		return this.userService.findProfile(id);
	}

	@Get('/getLogs/:id')
	@SwaggerGetUserLogs()
	getUserLogs(@Param('id', ParseIntPipe) id: number) {
		return this.userService.findUserLogs(id);
	}

	@Get('/logsByGroup/:id')
	@SwaggerGetLogsByGroup()
	async getLogsByGroup(@Param('id', ParseIntPipe) id: number) {
		const res = await this.userService.findLogsByGroup(id);
		// 过滤返回的数据
		return res.map((item) => ({
			result: item.result,
			count: item.count,
		}));
	}
}
