import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
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
	updateUser(@Body() user: User, @Param('id') id: number) {
		return this.userService.update(id, user);
	}

	@Delete('deleteUser/:id')
	removeUser(@Param('id') id: string) {
		console.log(id, 'id');
		return this.userService.remove(Number(id));
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
