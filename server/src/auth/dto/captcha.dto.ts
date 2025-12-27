import { IsNumber, IsOptional, IsString } from 'class-validator';

export class CaptchaDto {
	@IsOptional()
	@IsNumber()
	size: number;

	@IsOptional()
	@IsNumber()
	fontSize: number;

	@IsOptional()
	@IsNumber()
	width: number;

	@IsOptional()
	@IsNumber()
	height: number;

	@IsOptional()
	@IsString()
	background: string;

	@IsOptional()
	@IsString()
	noise: number;
}
