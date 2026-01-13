import { IsNumber, IsOptional, IsString } from 'class-validator';

export class EmailOptionsDTO {
	@IsOptional()
	@IsString()
	key: string;

	@IsOptional()
	@IsNumber()
	timeout: number;
}
