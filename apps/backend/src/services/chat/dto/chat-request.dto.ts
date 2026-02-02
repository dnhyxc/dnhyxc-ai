import { Type } from 'class-transformer';
import {
	ArrayMinSize,
	IsArray,
	IsBoolean,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';
import { ChatMessageDto } from './chat-message.dto';

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
	@IsString({ each: true })
	filePaths?: string[];
}
