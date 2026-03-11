import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateOcrDto {
	@IsNotEmpty({
		message: '图片 url 不能为空',
	})
	url: string;

	@IsString()
	@IsOptional()
	prompt?: string;

	@IsBoolean()
	@IsOptional()
	stream: boolean = true;
}
