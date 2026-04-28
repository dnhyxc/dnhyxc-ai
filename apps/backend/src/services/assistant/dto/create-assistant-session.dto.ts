import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

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

	/**
	 * 是否强制创建新会话：
	 * - 不传/false：保持兼容旧行为（同一 knowledgeArticleId 复用最近会话）
	 * - true：无视最近会话，始终新建（用于「新对话」）
	 */
	@IsOptional()
	@IsBoolean()
	forceNew?: boolean;
}
