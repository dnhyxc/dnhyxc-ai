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

export class AttachmentDto {
	@IsString()
	id: string;

	@IsString()
	filename: string;

	@IsString()
	mimetype: string;

	@IsString()
	originalname: string;

	@IsString()
	path: string;

	@IsNumber()
	size: number;
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

export class ChatRequestDto {
	@IsArray()
	@ArrayMinSize(1, { message: '至少需要一条消息' })
	@ValidateNested({ each: true })
	@Type(() => ChatMessageDto)
	messages: ChatMessageDto[];

	@IsOptional()
	@IsString()
	sessionId?: string;

	@IsOptional()
	@IsBoolean()
	stream?: boolean;

	@IsOptional()
	@IsArray()
	// @ValidateNested({ each: true }) // 启用对数组内每个对象的嵌套验证
	@Type(() => AttachmentDto) // 指定数组内对象的类型为 AttachmentDto
	attachments?: AttachmentDto[];

	@IsString()
	@IsOptional()
	thinking?: 'enabled' | 'disabled'; // 'enabled' | 'disabled'

	@IsNumber()
	@IsOptional()
	max_tokens?: number;

	@IsNumber()
	@IsOptional()
	temperature?: number; // [0.0, 1.0]

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
}
