import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsUUID,
	Max,
	Min,
} from 'class-validator';

/** 书架列表查询（分页） */
export class QueryEbookShelfDto {
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	pageNo?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(1)
	@Max(100)
	pageSize?: number;

	@IsOptional()
	@IsUUID()
	categoryId?: string;

	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	@IsBoolean()
	uncategorizedOnly?: boolean;
}
