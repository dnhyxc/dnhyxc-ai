import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MessageDto {
	@IsString()
	sessionId: string;
}

export class HistoryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	pageSize?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	pageNo?: number;

	@IsString()
	@IsOptional()
	userId?: string;
}
