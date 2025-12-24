import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	NotAcceptableException,
	NotFoundException,
	Param,
	ParseIntPipe,
	Patch,
	Post,
	Query,
	Req,
	UnauthorizedException,
	UseFilters,
	UseGuards,
} from '@nestjs/common';
import { TypeormFilter } from 'src/filters/typeorm.filter';
import { AdminGuard } from 'src/guards/admin.guard';
import { JwtGuard } from 'src/guards/jwt.guard';
import { CreateUserDTO } from './dto/create-user.dto';
import { GetUserDto } from './dto/get-user.dto';
import { CreateUserPipe } from './pipes/create-user.pipe';
import { User } from './user.entity';
import { UserService } from './user.service';

@Controller('user')
// 添加 TypeormFilter 异常过滤器
@UseFilters(new TypeormFilter())
// 添加 JwtGuard 守卫
@UseGuards(JwtGuard)
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Post('/addUser')
	addUser(@Body(CreateUserPipe) user: CreateUserDTO) {
		return this.userService.create(user as User);
	}

	@Get('/getUsers')
	/**
	 * 1. 装饰器的执行顺序：方法的装饰器如果有多个，则是从下往上执行。
	 * @UserGuards(AdminGuard) 后执行
	 * @UseGuards(AuthGuard('jwt')) 先执行
	 * 2. 如果使用 UserGuards 传递多个守卫，则是从前往后执行，如果前面的 Guard 没有通过，泽后面的 Guard 不会执行。
	 * 3. 只有先使用 AuthGuard('jwt') 之后，才会触发 Passport 将 user 信息添加到 req 上。否则在 AdminGuard 中将无法获取到 user 信息
	 */
	@UseGuards(AdminGuard)
	getUsers(@Query() query: GetUserDto) {
		return this.userService.findAll(query);
	}

	@Get('/getUserById/:id')
	getUserById(@Param('id', ParseIntPipe) id: number) {
		return this.userService.findOne(id);
	}

	@Patch('/updateUser/:id')
	async updateUser(
		@Body() user: User,
		@Param('id', ParseIntPipe) id: number,
		@Req() req,
	) {
		if (!id) return new BadRequestException('id is required');
		// 使用 jwt Passport 向 req 上添加的 user 信息，对比较用户 id
		if (req.user.userId === id) {
			const res = await this.userService.update(id, user);
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
	async removeUser(@Param('id') id: string) {
		if (!id) throw new BadRequestException('id is required');
		const res = await this.userService.remove(id);
		if (res) {
			return { username: res.username, id: id };
		} else {
			throw new NotFoundException('User not found');
		}
	}

	// ParseIntPipe 将参数转换成数字
	@Get('/profile')
	getUserProfile(
		@Query('id', ParseIntPipe) id: number,
		// 这里 req 中的 user 是通过 AuthGuard('jwt) 中的 validate 方法返回的
		// 是通过 PassportModule 自动添加的
		// @Req() req,
	) {
		// console.log('getUserProfile', req.user);
		return this.userService.findProfile(id);
	}

	// @Get('/logs')
	// getUserLogs() {
	// 	return this.userService.findUserLogs(2);
	// }

	// @Get('/logsByGroup')
	// async getLogsByGroup() {
	// 	const res = await this.userService.findLogsByGroup(2);
	//   // 过滤返回的数据
	// 	return res.map((item) => ({
	// 		result: item.result,
	// 		count: item.count,
	// 	}));
	// }
}
