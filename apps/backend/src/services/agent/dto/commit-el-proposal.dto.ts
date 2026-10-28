import { IsIn, IsOptional, IsUUID } from 'class-validator';

/** 确认条直提交：不经过模型，也不写入用户消息 */
export class CommitElProposalDto {
	@IsUUID()
	sessionId!: string;

	@IsUUID()
	proposalId!: string;

	/** 回执语言，与前端 locale 对齐 */
	@IsOptional()
	@IsIn(['zh-CN', 'en-US'])
	lang?: 'zh-CN' | 'en-US';
}
