import {
	BadRequestException,
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	NotAcceptableException,
	NotFoundException,
	Param,
	Patch,
	Post,
	Query,
	UnauthorizedException,
	UseFilters,
} from '@nestjs/common';
import { TypeormFilter } from 'src/filters/typeorm.filter';
import { User } from './user.entity';
import { UserService } from './user.service';
import type { GetUserDTO } from './user.types';

@Controller('user')
// 添加 TypeormFilter 异常过滤器
@UseFilters(new TypeormFilter())
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Get('/getUsers')
	getUsers(@Query() query: GetUserDTO) {
		return this.userService.findAll(query);
	}

	@Get('/getUser/:id')
	getUser() {
		return 'heool world';
	}

	@Post('/addUser')
	addUser(@Body() user: User) {
		return this.userService.create(user);
	}

	@Patch('/updateUser/:id')
	async updateUser(
		@Body() user: User,
		@Param('id') id: number,
		@Headers() headers,
	) {
		// TODO: 验证用户权限，这里后续需要通过用户 token 进行校验，目前知识一个简单的测试
		if (headers.authorization === id) {
			if (!id) return new BadRequestException('id is required');
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

	@Get('/profile')
	getUserProfile(@Query('id') id: string) {
		console.log(id, 'profile');
		return this.userService.findProfile(Number(id));
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
