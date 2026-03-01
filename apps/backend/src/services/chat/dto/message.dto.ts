import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
	ValidateNested,
} from 'class-validator';
import { MessageRole } from '../chat.entity';
import { AttachmentDto } from './chat-request.dto';

export class MessageDto {
	@IsString()
	sessionId: string;
}

export class HistoryDto {
	@IsNumber()
	@IsOptional()
	pageSize: number;

	@IsNumber()
	@IsOptional()
	pageNo: number;

	@IsString()
	@IsOptional()
	userId: string;
}

export class SaveDto {
	@IsString()
	sessionId: string;

	@IsEnum(MessageRole)
	role: MessageRole;

	@IsString()
	content: string;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true }) // 启用对数组内每个对象的嵌套验证
	@Type(() => AttachmentDto) // 指定数组内对象的类型为 AttachmentDto
	attachments?: AttachmentDto[];

	@IsOptional()
	@IsString()
	parentId?: string | null;

	@IsOptional()
	@IsBoolean()
	isRegenerate?: boolean;

	@IsOptional()
	@IsString()
	chatId?: string;

	@IsOptional()
	@IsArray()
	@IsString({ each: true })
	childrenIds?: string[];

	@IsOptional()
	@IsString()
	currentChatId?: string;
}
