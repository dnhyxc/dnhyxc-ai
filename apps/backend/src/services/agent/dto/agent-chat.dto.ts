import {
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
} from 'class-validator';

/** LangChain Agent 流式对话请求 */
export class AgentChatDto {
	@IsOptional()
	@IsUUID()
	sessionId?: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(100_000)
	content!: string;

	@IsOptional()
	@IsString()
	@MaxLength(255)
	title?: string;

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

	/**
	 * 专项模式：英语学习时传 `english_learning`，服务端附加对应系统提示。
	 */
	@IsOptional()
	@IsIn(['english_learning'])
	assistMode?: 'english_learning';
}
