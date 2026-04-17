import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsNumber,
	IsObject,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';
import { ChatMessageDto } from './chat-message.dto';

export class UserMessageDto {
	@IsString()
	chatId: string;

	@IsString()
	content: string;

	@IsString()
	role: 'user';

	@IsOptional()
	@IsString()
	parentId?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	childrenIds?: string[];
}

export class AssistantMessageDto {
	@IsString()
	chatId: string;

	@IsString()
	content: string;

	@IsString()
	role: 'assistant';

	@IsOptional()
	@IsString()
	parentId?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	childrenIds?: string[];
}

export class CreateSessionDto {
	@IsString()
	@IsOptional()
	sessionId: string;
}

export class ChatRequestDto {
	@IsArray()
	@ArrayMinSize(1, { message: '至少需要一条消息' })
	@ValidateNested({ each: true })
	@Type(() => ChatMessageDto)
	messages: ChatMessageDto[];

	@IsOptional()
	@IsString()
	sessionId: string;

	@IsOptional()
	@IsBoolean()
	stream?: boolean;

	@IsString()
	@IsOptional()
	thinking?: 'enabled' | 'disabled';

	@IsNumber()
	@IsOptional()
	maxTokens?: number;

	@IsNumber()
	@IsOptional()
	temperature?: number;

	@IsBoolean()
	@IsOptional()
	stop?: boolean;

	@IsBoolean()
	@IsOptional()
	isRegenerate?: boolean;

	@IsOptional()
	@IsString()
	parentId?: string;

	@IsOptional()
	@IsObject()
	userMessage?: UserMessageDto;

	@IsOptional()
	@IsObject()
	assistantMessage?: AssistantMessageDto;

	@IsBoolean()
	@IsOptional()
	isContinuation?: boolean;

	@IsString()
	@IsOptional()
	role?: 'user' | 'assistant' | 'system';

	@IsBoolean()
	@IsOptional()
	webSearch?: boolean;
}
