import { IsIn, IsOptional, IsString } from 'class-validator';

export class WechatLoginDto {
	@IsString()
	code!: string;

	@IsIn(['mini_program', 'mp', 'open_platform'])
	scene!: 'mini_program' | 'mp' | 'open_platform';

	@IsOptional()
	@IsString()
	deviceId?: string;
}
