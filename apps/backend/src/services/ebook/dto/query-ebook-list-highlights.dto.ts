import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/** GET /highlights/:bookId — 传 pageNo/pageSize 时返回分页；否则返回数组（阅读器兼容） */
export class QueryEbookListHighlightsDto {
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
}
