import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** 按知识条目标识查询已绑定的助手会话 */
export class AssistantSessionForKnowledgeDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(1024)
	knowledgeArticleId!: string;
}
