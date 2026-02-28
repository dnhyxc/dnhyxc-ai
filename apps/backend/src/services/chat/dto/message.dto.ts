import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsNumber,
	IsOptional,
	IsString,
} from 'class-validator';
import { MessageRole } from '../chat.entity';

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
	@IsString({ each: true })
	filePaths?: string[];

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
