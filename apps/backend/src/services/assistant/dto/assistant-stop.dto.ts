import { IsOptional, IsUUID, ValidateIf } from 'class-validator';

export class AssistantStopDto {
	/**
	 * 持久化会话停止句柄：
	 * - 适用于 `sessionId` 模式（落库、多轮）。
	 */
	@IsOptional()
	@ValidateIf((o) => o.streamId == null)
	@IsUUID()
	sessionId?: string;

	/**
	 * ephemeral（不落库）流式停止句柄：
	 * - 由 `/assistant/sse` 在 `ephemeral=true` 时下发
	 * - stop 时传入 `streamId` 即可（无需 sessionId）
	 */
	@IsOptional()
	@ValidateIf((o) => o.sessionId == null)
	@IsUUID()
	streamId?: string;
}
