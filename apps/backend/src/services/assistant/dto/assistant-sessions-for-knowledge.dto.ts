import { Type } from 'class-transformer';
import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** 按知识条目标识查询该文章下全部助手会话（按 updatedAt 倒序） */
export class AssistantSessionsForKnowledgeDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(1024)
	knowledgeArticleId!: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	pageNo?: number = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(100)
	pageSize?: number = 20;
}
