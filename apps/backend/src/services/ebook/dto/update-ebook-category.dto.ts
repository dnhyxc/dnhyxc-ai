import {
	IsInt,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';

export class UpdateEbookCategoryDto {
	@IsOptional()
	@IsString()
	@MinLength(1)
	@MaxLength(64)
	name?: string;

	@IsOptional()
	@IsInt()
	sortOrder?: number;
}
