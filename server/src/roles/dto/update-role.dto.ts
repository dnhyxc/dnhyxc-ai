import { PartialType } from '@nestjs/mapped-types';
import {
	IsArray,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
} from 'class-validator';
import { Menus } from '../../menus/menus.entity';
import { CreateRoleDto } from './create-role.dto';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {
	@IsNumber(
		{},
		{
			message: 'id 必须为数字',
		},
	)
	@IsNotEmpty({
		message: 'id 不能为空',
	})
	id: number;

	@IsString()
	@IsOptional()
	@IsNotEmpty()
	name: string;

	@IsArray()
	@IsOptional()
	menuIds: Menus[];
}
