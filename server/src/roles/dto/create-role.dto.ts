import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Menus } from '../../menus/menus.entity';

export class CreateRoleDto {
	@IsString()
	@IsNotEmpty()
	name: string;

	@IsArray()
	@IsOptional() // 设置为可选参数
	menuIds: Menus[];
}
