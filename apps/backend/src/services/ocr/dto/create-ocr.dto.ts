import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateOcrDto {
	@IsNotEmpty({
		message: '图片 url 不能为空',
	})
	url: string;
	@IsOptional()
	prompt?: string;
}
