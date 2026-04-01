import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveKnowledgeDto {
	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;

	@IsString()
	@MaxLength(5_000_000)
	content!: string;

	@IsString()
	@MaxLength(255)
	author?: string;

	@Type(() => Number)
	@IsInt()
	authorId?: number;
}
