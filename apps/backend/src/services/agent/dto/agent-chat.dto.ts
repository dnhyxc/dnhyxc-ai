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

	/**
	 * 快捷意图等「仅影响本轮模型输入」的前缀，不入库：落库的 user 行仅保存 `content`。
	 * 英语学习等场景由前端传入，服务端拼入 LangChain HumanMessage（见 AgentService）。
	 */
	@IsOptional()
	@IsString()
	@MaxLength(20_000)
	intentPrefix?: string;

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
