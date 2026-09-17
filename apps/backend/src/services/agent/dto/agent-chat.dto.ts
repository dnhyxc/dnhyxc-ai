import {
	ArrayMaxSize,
	IsArray,
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
	 * 有值即拼入本轮 HumanMessage（英语学习 / 知识库正文等）。
	 */
	@IsOptional()
	@IsString()
	@MaxLength(80_000)
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
	 * 专项模式：英语学习 / Skill 生成，服务端附加对应系统提示。
	 */
	@IsOptional()
	@IsIn(['english_learning', 'skill_generate'])
	assistMode?: 'english_learning' | 'skill_generate';

	/** 用户本轮指定的 Skill ID（有序）；服务端强制加载并预置 apply_skill */
	@IsOptional()
	@IsArray()
	@ArrayMaxSize(8)
	@IsUUID('4', { each: true })
	skillIds?: string[];

	/**
	 * 业务消息落库来源（缺省时按会话归属推断；显式 agent 仅兼容遗留）。
	 * assistant / english_learning / skill_try 写各自业务表。
	 */
	@IsOptional()
	@IsIn(['agent', 'assistant', 'english_learning', 'skill_try'])
	memorySource?: 'agent' | 'assistant' | 'english_learning' | 'skill_try';

	/** memorySource=assistant 时必填：知识库助手会话 id */
	@IsOptional()
	@IsUUID()
	assistantSessionId?: string;
}
