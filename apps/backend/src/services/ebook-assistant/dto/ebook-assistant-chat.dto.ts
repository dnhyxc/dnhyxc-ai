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

export class EbookAssistantChatDto {
	@IsOptional()
	@IsUUID()
	sessionId?: string;

	@IsOptional()
	@IsUUID()
	bookId?: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(100_000)
	content!: string;

	/** 拼入本轮发给模型的 user 正文之后，不入库 */
	@IsOptional()
	@IsString()
	@MaxLength(500_000)
	extraUserContentForModel?: string;

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
