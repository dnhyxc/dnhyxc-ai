import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** GET /thoughts/:bookId — 按 CFI spine 路径前缀过滤（逗号分隔，如 `/6/4,/6/6`） */
export class QueryEbookListThoughtsDto {
	@IsOptional()
	@IsString()
	@MaxLength(2000)
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	spineHints?: string;
}
