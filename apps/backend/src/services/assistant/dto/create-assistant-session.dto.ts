import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAssistantSessionDto {
	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;

	/** 与知识库当前编辑条目标识一致，便于按文章复用同一会话 */
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	knowledgeArticleId?: string;
}
