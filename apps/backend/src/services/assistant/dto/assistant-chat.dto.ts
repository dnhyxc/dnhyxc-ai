import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsBoolean,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsNumber,
	IsOptional,
	IsString,
	IsUUID,
	Max,
	MaxLength,
	Min,
	ValidateNested,
} from 'class-validator';

/** 流式请求中的历史轮次（与 `AssistantChatDto.content` 共同构成完整上下文；ephemeral 模式见设计文档）。 */
export class AssistantContextTurnDto {
	@IsIn(['user', 'assistant'])
	role!: 'user' | 'assistant';

	@IsString()
	@MaxLength(100_000)
	content!: string;
}

/**
 * 助手发送一条用户消息并流式返回（持久化模式多轮依赖 `sessionId`）。
 * `ephemeral` + `contextTurns` 用于知识未保存草稿：见 `docs/knowledge/knowledge-assistant-ephemeral-persistence.md`。
 */
export class AssistantChatDto {
	@IsOptional()
	@IsUUID()
	sessionId?: string;

	/** 无 sessionId 时按知识条目复用或创建会话（与知识库编辑器绑定） */
	@IsOptional()
	@IsString()
	@MaxLength(1024)
	knowledgeArticleId?: string;

	/**
	 * 不落库流式：仅智谱流式输出；须配合 `contextTurns` 做多轮上下文。
	 * 与 `sessionId` / `knowledgeArticleId` 互斥。
	 */
	@IsOptional()
	@IsBoolean()
	ephemeral?: boolean;

	@IsOptional()
	@IsArray()
	@ArrayMaxSize(120)
	@ValidateNested({ each: true })
	@Type(() => AssistantContextTurnDto)
	contextTurns?: AssistantContextTurnDto[];

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
