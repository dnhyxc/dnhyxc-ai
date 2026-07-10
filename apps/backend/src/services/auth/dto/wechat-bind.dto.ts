import { IsOptional, IsString, MinLength } from 'class-validator';

export class WechatBindDto {
	@IsString()
	bind_token!: string;

	/** Web 账号设置页生成的 6 位关联码 */
	@IsOptional()
	@IsString()
	link_code?: string;

	@IsOptional()
	@IsString()
	username?: string;

	@IsOptional()
	@IsString()
	@MinLength(1)
	password?: string;
}
