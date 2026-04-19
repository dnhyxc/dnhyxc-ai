import {
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
} from 'class-validator';

/** 助手发送一条用户消息并流式返回（多轮依赖 sessionId） */
export class AssistantChatDto {
	@IsOptional()
	@IsUUID()
	sessionId?: string;

	/** 无 sessionId 时按知识条目复用或创建会话（与知识库编辑器绑定） */
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	knowledgeArticleId?: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(100_000)
	content: string;

	@IsOptional()
	@IsInt()
	@Min(256)
	@Max(8192)
	maxTokens?: number;

	@IsOptional()
	@IsNumber()
	@Min(0)
	@Max(1)
	temperature?: number;
}
