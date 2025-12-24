import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserService } from 'src/user/user.service';

@Injectable()
export class UserGuard implements CanActivate {
	constructor(private userService: UserService) {}
	async canActivate(context: ExecutionContext): Promise<boolean> {
		const req = context.switchToHttp().getRequest();
		// 2. 获取请求中的用户信息进行逻辑上的判断 -> 角色判断
		console.log(req?.user);
		return true;
	}
}
