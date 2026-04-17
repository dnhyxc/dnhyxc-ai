import { IsOptional, IsString } from 'class-validator';
import { ChatRequestDto } from './chat-request.dto';

export class ChatContinueDto extends ChatRequestDto {
	@IsOptional()
	@IsString()
	targetChatId?: string;
}
