import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class EbookAssistantSessionsForBookDto {
	@IsUUID()
	bookId!: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	pageNo?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	pageSize?: number;
}
