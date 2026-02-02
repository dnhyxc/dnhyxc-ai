import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ChatResponseDto {
	@IsNotEmpty()
	@IsString()
	content: string;

	@IsOptional()
	@IsString()
	sessionId?: string;

	@IsOptional()
	@IsString()
	finishReason?: string;
}
