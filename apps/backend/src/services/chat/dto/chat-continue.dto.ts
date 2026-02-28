import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';
import { ChatMessageDto } from './chat-message.dto';
import { AssistantMessageDto, UserMessageDto } from './chat-request.dto';

export class ChatContinueDto {
	@IsString()
	sessionId: string;

	@IsOptional()
	@IsString()
	parentId?: string;

	@IsOptional()
	@IsObject()
	userMessage?: UserMessageDto;

	@IsOptional()
	@IsObject()
	assistantMessage?: AssistantMessageDto;

	@IsOptional()
	@IsString()
	currentChatId?: string;

	@IsOptional()
	@IsBoolean()
	isRegenerate?: boolean;

	@IsOptional()
	@IsNumber()
	max_tokens?: number;

	@IsOptional()
	@IsNumber()
	temperature?: number;
}
