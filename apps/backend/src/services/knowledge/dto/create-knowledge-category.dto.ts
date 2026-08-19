import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateKnowledgeCategoryDto {
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	name: string;
}
