import { IsNotEmpty, IsString, Length } from 'class-validator';
import { Roles } from 'src/roles/roles.entity';

export class CreateUserDTO {
	@IsString({
		message: '用户名必须为字符串',
	})
	@IsNotEmpty({
		message: '用户名不能为空',
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
	username: string;

	@IsString({
		message: '密码必须是字符串',
	})
	@IsNotEmpty({
		message: '密码不能为空',
	})
	@Length(6, 32, {
		message: '用户名长度必须在 5 到 33 个字符之间',
	})
	password: string;

	roles?: Roles[] | number[];
}
