/**
 * 知识库「草稿阶段」助手对话迁入正式条目后的落库契约（对应 `POST assistant/session/import-transcript`）。
 * 设计说明见仓库文档：`docs/knowledge/knowledge-assistant-ephemeral-persistence.md`。
 */
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsNotEmpty,
	IsString,
	MaxLength,
	ValidateNested,
} from 'class-validator';

export class AssistantTranscriptLineDto {
	@IsIn(['user', 'assistant'])
	role!: 'user' | 'assistant';

	@IsString()
	@MaxLength(100_000)
	content!: string;
}

/** 将客户端草稿阶段的对话迁入已保存知识条目对应的助手会话（落库） */
export class ImportAssistantTranscriptDto {
	@IsString()
	@IsNotEmpty()
	@MaxLength(1024)
	knowledgeArticleId!: string;

	@IsArray()
	@ArrayMaxSize(200)
	@ValidateNested({ each: true })
	@Type(() => AssistantTranscriptLineDto)
	lines!: AssistantTranscriptLineDto[];
}
