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
}
