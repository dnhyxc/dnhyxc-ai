import { Type } from 'class-transformer';
import {
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
} from 'class-validator';

export class QueryLearningNoteDto {
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	pageNo?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	pageSize?: number;

	@IsOptional()
	@IsString()
	@MaxLength(200)
	title?: string;
}
