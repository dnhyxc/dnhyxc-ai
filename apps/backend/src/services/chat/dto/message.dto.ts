import { Type } from 'class-transformer';
import {
	IsArray,
	IsBoolean,
	IsEnum,
	IsInt,
	IsOptional,
	IsString,
	Min,
	ValidateNested,
} from 'class-validator';
import { MessageRole } from '../chat.entity';
import { AttachmentDto } from './chat-request.dto';

/** Serper organic 单条（与落库 JSON 结构一致） */
export class SerperOrganicItemDto {
	@IsString()
	title: string;

	@IsString()
	link: string;

	@IsOptional()
	@IsString()
	snippet?: string;
}

export class MessageDto {
	@IsString()
	sessionId: string;
}

export class HistoryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	pageSize?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	pageNo?: number;

	@IsString()
	@IsOptional()
	userId?: string;
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

	@IsString()
	@IsOptional()
	currentChatId?: string;

	@IsBoolean()
	@IsOptional()
	// true 表示续写模式，需要追加内容而不是替换
	isContinuation?: boolean;

	@IsOptional()
	@IsArray()
	@ValidateNested({ each: true })
	@Type(() => SerperOrganicItemDto)
	searchOrganic?: SerperOrganicItemDto[];
}
