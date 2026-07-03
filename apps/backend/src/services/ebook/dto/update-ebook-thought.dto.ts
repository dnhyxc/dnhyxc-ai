import {
	IsBoolean,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';

export class UpdateEbookThoughtDto {
	@IsString()
	@MinLength(1)
	@MaxLength(16384)
	content: string;

	@IsOptional()
	@IsBoolean()
	isPublic?: boolean;
}
