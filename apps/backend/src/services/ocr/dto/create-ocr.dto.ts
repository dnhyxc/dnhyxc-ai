import { IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateOcrDto {
	@IsUrl(
		{},
		{
			message: '不是合法的 url',
		},
	)
	@IsNotEmpty({
		message: '图片 url 不能为空',
	})
	url: string;
	@IsOptional()
	prompt?: string;
}
