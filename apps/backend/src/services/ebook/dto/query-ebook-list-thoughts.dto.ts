import { Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsNumber,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** GET /thoughts/:bookId — 按 CFI spine 路径前缀过滤（逗号分隔，如 `/6/4,/6/6`） */
export class QueryEbookListThoughtsDto {
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	spineHints?: string;

	/** 传入任一分页参数时返回 { list, total, pageNo, pageSize }；否则仍返回数组（阅读器兼容） */
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

	/** true：仅公开想法（全书想法插件）；省略则保持阅读器可见性（含本人私密） */
	@IsOptional()
	@Transform(({ value }) => value === 'true' || value === true)
	@IsBoolean()
	publicOnly?: boolean;
}
