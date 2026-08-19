import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	MaxLength,
	Min,
} from 'class-validator';

/** 知识库列表查询（分页 + 标题模糊 + 分类） */
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

	/** 可选；列表可见范围以 JWT 用户为准（本人 OR 公开），不再依赖此字段过滤 */
	@IsOptional()
	@Type(() => Number)
	@IsInt({ message: 'authorId 必须为数字' })
	@Min(1, { message: 'authorId 必须大于 0' })
	authorId?: number;

	@IsOptional()
	@IsUUID()
	categoryId?: string;

	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	@IsBoolean()
	uncategorizedOnly?: boolean;
}
