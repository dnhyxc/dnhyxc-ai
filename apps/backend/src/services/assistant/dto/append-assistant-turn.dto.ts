import { IsString, IsUUID, MaxLength } from 'class-validator';

/** Skill 路径：Agent 生成完成后，将本轮对话追加到知识库助手会话表 */
export class AppendAssistantTurnDto {
	@IsUUID()
	sessionId!: string;

	@IsString()
	@MaxLength(100_000)
	userContent!: string;

	@IsString()
	@MaxLength(100_000)
	assistantContent!: string;
}
