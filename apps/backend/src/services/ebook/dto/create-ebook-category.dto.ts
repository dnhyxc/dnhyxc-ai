import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEbookCategoryDto {
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	name: string;
}
