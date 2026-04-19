import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** 将已有助手会话改绑到新的知识条目标识（如草稿首次保存得到正式 id） */
export class UpdateAssistantSessionKnowledgeDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(1024)
	knowledgeArticleId!: string;
}
