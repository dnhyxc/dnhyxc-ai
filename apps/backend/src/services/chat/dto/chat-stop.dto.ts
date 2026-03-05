import { IsOptional, IsString } from 'class-validator';

export class ChatStopDto {
	@IsString()
	sessionId: string;

	@IsString()
	@IsOptional()
	assistantMessageId?: string; // 可选，用于直接定位消息
}
