import {
	BadRequestException,
	Body,
	ClassSerializerInterceptor,
	Controller,
	Delete,
	Get,
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
import {
	ApiBearerAuth,
	ApiOperation,
	ApiParam,
	ApiQuery,
	ApiResponse,
} from '@nestjs/swagger';
// import { TypeormFilter } from '../filters/typeorm.filter';
// import { AdminGuard } from '../guards/admin.guard';
import { JwtGuard } from '../guards/jwt.guard';
import { ResponseInterceptor } from '../interceptors/response.interceptor';
import { CreateUserDTO } from './dto/create-user.dto';
import { GetUserDto } from './dto/get-user.dto';
import { UpdateUserDTO } from './dto/update-user.dto';
import { CreateUserPipe } from './pipes/create-user.pipe';
import { User } from './user.entity';
import { UserService } from './user.service';

@Controller('user')
// 生成文档需要的装饰器，用于携带 token 信息
@ApiBearerAuth()
// TODO: 添加 TypeormFilter 异常过滤器，目前这会导致 DOT 报错不能正常响应，要使用的话，后续需要优化，目前直接使用全局错误响应过滤器
// @UseFilters(new TypeormFilter())
// 添加 JwtGuard 守卫
@UseGuards(JwtGuard)
// ClassSerializerInterceptor 设置返回字段过滤，ResponseInterceptor 设置响应拦截器，统一响应的格式
@UseInterceptors(ClassSerializerInterceptor, ResponseInterceptor)
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Post('/addUser')
	@ApiOperation({ summary: '新增用户', description: '新增用户接口' })
	@ApiResponse({
		status: 200,
		description: '创建用户成功',
		schema: {
			default: {
				id: 1,
				username: 'admin',
				roles: [
					{
						id: 1,
						name: 'admin',
					},
				],
			},
		},
	})
	// 使用 CreateUserPipe 管道，对接收的参数进行处理
	addUser(@Body(CreateUserPipe) user: CreateUserDTO) {
		return this.userService.create(user as User);
	}

	@Get('/getUsers')
	@ApiOperation({ summary: '获取用户列表', description: '获取用户列表接口' })
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
	@ApiOperation({
		summary: '根据id查询用户信息',
		description: '根据id查询用户信息接口',
	})
	@ApiParam({
		name: 'id',
		description: '用户id',
		required: true,
	})
	getUserById(@Param('id', ParseIntPipe) id: number) {
		return this.userService.findOne(id);
	}

	@Post('/updateUser')
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
				throw new NotAcceptableException('User update failed');
			}
		} else {
			throw new UnauthorizedException('暂无权限');
		}
	}

	@Delete('deleteUser/:id')
	@ApiParam({
		name: 'id',
		description: '用户id',
		required: true,
	})
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
	@ApiOperation({
		summary: '获取用户信息',
		description: '获取用户信息接口',
	})
	@ApiQuery({
		name: 'id',
		description: '用户id',
		required: true,
	})
	getUserProfile(
		@Query('id', ParseIntPipe) id: number,
		// 这里 req 中的 user 是通过 AuthGuard('jwt) 中的 validate 方法返回的
		// 是通过 PassportModule 自动添加的
		// @Req() req,
	) {
		// console.log('getUserProfile', req.user);
		return this.userService.findProfile(id);
	}

	@Get('/getLogs/:id')
	@ApiOperation({
		summary: '获取用户日志信息',
		description: '获取用户日志信息接口',
	})
	@ApiParam({
		name: 'id',
		description: '用户id',
		required: true,
	})
	getUserLogs(@Param('id', ParseIntPipe) id: number) {
		return this.userService.findUserLogs(id);
	}

	@Get('/logsByGroup/:id')
	@ApiOperation({
		summary: '获取用户日志信息',
		description: '获取用户日志信息接口',
	})
	@ApiParam({
		name: 'id',
		description: '用户id',
		required: true,
	})
	async getLogsByGroup(@Param('id', ParseIntPipe) id: number) {
		const res = await this.userService.findLogsByGroup(id);
		// 过滤返回的数据
		return res.map((item) => ({
			result: item.result,
			count: item.count,
		}));
	}
}
