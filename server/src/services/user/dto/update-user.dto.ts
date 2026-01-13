import { ApiProperty } from '@nestjs/swagger';
import {
	IsEmail,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	Length,
} from 'class-validator';
import { Roles } from '../../roles/roles.entity';
import { Profile } from '../profile.entity';

export class UpdateUserDTO {
	@IsNumber()
	@IsNotEmpty({
		message: '用户id不能为空',
	})
	id: number;

	@IsString({
		message: '用户名必须为字符串',
	})
	@Length(2, 20, {
		/**
		 * value: 当前用户传入的值
		 * target: 当前验证的类
		 * property: 当前验证的属性名
		 * constraint1: 当前验证的属性的验证规则，第一个参数，即 2。
		 * constraint2: 当前验证的属性的验证规则，第二个参数，即 20。
		 * ...
		 * message: 当前验证失败的提示信息。
		 */
		message: '用户名长度必须在 1 到 21 个字符之间',
	})
	@IsOptional()
	@ApiProperty({
		example: 'admin',
	})
	username?: string;

	@ApiProperty({
		example: 'admin',
	})
	@IsString({
		message: '密码必须是字符串',
	})
	@Length(6, 32, {
		message: '用户名长度必须在 5 到 33 个字符之间',
	})
	@IsOptional()
	password: string;

	@ApiProperty({
		example: [1],
	})
	@IsOptional()
	roles: Roles[] | number[];

	@ApiProperty({
		example: {
			gender: 'male',
			photo: 'img.png',
			address: '上海',
		},
	})
	@IsOptional()
	profile: Profile;
}

export class UpdateEmailDTO {
	@IsNumber()
	@IsNotEmpty({
		message: '用户id不能为空',
	})
	id: number;

	@IsEmail(
		{},
		{
			message: '邮箱格式不正确',
		},
	)
	email: string;

	@IsString()
	@IsNotEmpty({
		message: '原邮箱验证码不能为空',
	})
	oldVerifyCode: number;

	@IsString()
	@IsNotEmpty({
		message: '新邮箱验证码不能为空',
	})
	newVerifyCode: number;

	@IsString()
	@IsNotEmpty({
		message: '原邮箱验证码 Key 不能为空',
	})
	oldVerifyCodeKey: string;

	@IsString()
	@IsNotEmpty({
		message: '新邮箱验证码 Key 不能为空',
	})
	newVerifyCodeKey: string;
}
