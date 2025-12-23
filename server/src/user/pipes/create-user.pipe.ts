/**
 * 处理 user.roles 的自定义管道
 * 在这里可以对前端传递过来的参数进行拦截，然后做后续处理
 */

import { Injectable, PipeTransform } from '@nestjs/common';
import { Roles } from 'src/roles/roles.entity';
import { CreateUserDTO } from '../dto/create-user.dto';

@Injectable()
export class CreateUserPipe implements PipeTransform {
	transform(value: CreateUserDTO) {
		if (value.roles && Array.isArray(value.roles) && value.roles.length > 0) {
			// Roles
			if ((value.roles[0] as Roles).id) {
				// 只取用户传递的 id 信息，防止用户随意给角色设置不符合规则的角色名称
				value.roles = value.roles.map((role) => role.id);
			}
			// number
		}
		return value;
	}
}
