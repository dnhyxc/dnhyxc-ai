import { IsOptional, IsString } from 'class-validator';

export class ChatMessageDto {
	@IsString()
	role: 'user' | 'assistant' | 'system';

	@IsString()
	content: string;

	@IsOptional()
	noSave?: boolean;
}
