import {
	Body,
	Controller,
	Delete,
	Get,
	Param,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import { User } from './user.entity';
import { UserService } from './user.service';
import type { GetUserDTO } from './user.types';

@Controller('user')
export class UserController {
	constructor(private readonly userService: UserService) {}

	@Get('/getUsers')
	getUsers(@Query() query: GetUserDTO) {
		console.log(query, 'query');
		return this.userService.findAll(query);
	}

	@Get('/getUser/:id')
	getUser() {
		return 'heool world';
	}

	@Post('/addUser')
	addUser(@Body() user: User) {
		console.log(user, 'user');
		return this.userService.create(user);
	}

	@Patch('/updateUser/:id')
	updateUser(@Body() user: User, @Param('id') id: number) {
		console.log(user, 'user');
		console.log(id, 'id');
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
