/**
 * 知识库「草稿阶段」助手对话迁入正式条目后的落库契约（对应 `POST assistant/session/import-transcript`）。
 * 设计说明见：`docs/knowledge/knowledge-assistant-complete.md`（总览）、`knowledge-assistant-ephemeral-persistence.md`（持久化专题）。
 *
 * `lines` 上限 200：客户端在草稿轮次超过上限时应发送 **按时间升序排列的最近 200 条**（`slice(-200)`），避免校验失败并保证落库为「当前可见」尾部对话。
 */
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsIn,
	IsNotEmpty,
	IsOptional,
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

	/**
	 * 目标会话 id（可选）：
	 * - 传入：迁入到该 session（会校验归属与 knowledgeArticleId 绑定）
	 * - 不传：兼容旧行为，迁入到该文章最近会话（不存在则新建）
	 */
	@IsOptional()
	@IsString()
	@MaxLength(128)
	sessionId?: string;

	/** 按时间从早到晚；条数 ≤200；超长草稿由客户端截断为最近 200 条再提交 */
	@IsArray()
	@ArrayMaxSize(200)
	@ValidateNested({ each: true })
	@Type(() => AssistantTranscriptLineDto)
	lines!: AssistantTranscriptLineDto[];
}
