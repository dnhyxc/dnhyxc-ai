import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** 按知识条目标识查询该文章下全部助手会话（按 updatedAt 倒序） */
export class AssistantSessionsForKnowledgeDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(1024)
	knowledgeArticleId!: string;
}
