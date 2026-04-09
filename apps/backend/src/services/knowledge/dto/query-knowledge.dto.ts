import { Type } from 'class-transformer';
import {
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	MaxLength,
	Min,
} from 'class-validator';

/** 知识库列表查询（分页 + 标题模糊） */
export class QueryKnowledgeDto {
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

	@Type(() => Number)
	@IsInt({ message: 'authorId 必传且必须为数字' })
	@Min(1, { message: 'authorId 必须大于 0' })
	authorId?: number;
}
