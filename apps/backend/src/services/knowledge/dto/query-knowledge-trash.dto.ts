import { Type } from 'class-transformer';
import {
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
} from 'class-validator';

/** 回收站列表查询（分页 + 标题模糊） */
export class QueryKnowledgeTrashDto {
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
